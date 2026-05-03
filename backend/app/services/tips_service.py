import os
import joblib
import pandas as pd
import numpy as np
from .config import MODEL_DIR, PARTIAL_FACTOR
from .firebase_service import firebase_service
from datetime import datetime, timedelta, timezone

class ModelService:
    _instance = None
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.device_stats = None
        self.base_recommendations = None
        self.recommendation_levels = None
        self.load_models()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_models(self):
        # Paths
        p_model = os.path.join(MODEL_DIR, "prophet_energy_model.pkl")
        p_scaler = os.path.join(MODEL_DIR, "temperature_scaler.pkl")
        p_stats = os.path.join(MODEL_DIR, "device_stats.pkl")
        p_recs = os.path.join(MODEL_DIR, "base_recommendations.pkl")
        p_levels = os.path.join(MODEL_DIR, "recommendation_levels.pkl")

        # Load
        try:
            self.model = joblib.load(p_model)
            self.scaler = joblib.load(p_scaler)
            self.device_stats = joblib.load(p_stats)
            self.base_recommendations = joblib.load(p_recs)
            self.recommendation_levels = joblib.load(p_levels)
            print("INFO: Models loaded successfully.")
        except Exception as e:
            print(f"ERROR: Failed to load models: {e}")
            # Ensure attributes are initialized even on failure to avoid crashes, though functionality will be impaired
            self.model = None

class TipsService:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        if hasattr(self, 'initialized'): return
        self.initialized = True
        
        self.models = ModelService.get_instance()
        self.std_multiplier = 1.0
        
        # Energy baseline cache for "reset to 0 at midnight" logic
        self.midnight_energy_offset = 0.0
        self.last_baseline_date = None
        
        # DataFrame to store historical daily usage for analysis
        self.df = pd.DataFrame(columns=['date', 'power_usage', 'temperature', 'device'])
        self.load_real_data()

    def load_real_data(self):
        """Fetch historical daily usage data from MongoDB sensor_readings."""
        try:
            from app.database import get_collection, is_db_connected
            if not is_db_connected():
                print("WARNING: MongoDB not connected. Tips service will use empty data.")
                return

            collection = get_collection('sensor_readings')
            if collection is None: return

            # Fetch last 30 days to compute historical context
            # We aggregate sensor readings into estimated daily totals per device.
            # Since historical pzem.energy might be missing, we use (voltage * current) as an estimate.
            pipeline = [
                {"$match": {
                    "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)},
                    "voltage": {"$gt": 100, "$lt": 300},
                    "current": {"$gt": 0, "$lt": 100}
                }},
                {"$project": {
                    "device": "$device_id",
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                    # Power (W) = Voltage * Current
                    "power": {"$multiply": ["$voltage", "$current"]},
                    "temperature": "$temperature"
                }},
                {"$group": {
                    "_id": {"device": "$device", "date": "$date"},
                    "avg_power": {"$avg": "$power"},
                    "avg_temp": {"$avg": "$temperature"}
                }},
                {"$project": {
                    "device": "$_id.device",
                    "date": "$_id.date",
                    # Estimated Energy (kWh) = Average Power * 24 hours / 1000
                    "power_usage": {"$divide": [{"$multiply": ["$avg_power", 24]}, 1000]},
                    "temperature": {"$ifNull": ["$avg_temp", 25.0]}
                }},
                {"$sort": {"date": 1}}
            ]
            
            records = list(collection.aggregate(pipeline))
            if records:
                self.df = pd.DataFrame(records)
                self.df['date'] = pd.to_datetime(self.df['date'])
                print(f"INFO: Successfully loaded {len(self.df)} historical usage records from MongoDB.")
            else:
                print("INFO: No historical usage data found in MongoDB sensor_readings.")
                
        except Exception as e:
            print(f"ERROR: Could not load historical data from MongoDB: {e}")

    def get_stats_for_device(self, device):
        """Get or compute mean/std for a device."""
        if self.models.device_stats is not None:
            stats_df = self.models.device_stats
            d_stat = stats_df[stats_df['device'] == device]
            if not d_stat.empty:
                return float(d_stat['mean'].values[0]), float(d_stat['std'].values[0])

        # Compute from loaded real data
        if not self.df.empty:
            d_df = self.df[self.df['device'] == device]
            if not d_df.empty:
                mean = d_df['power_usage'].mean()
                std = d_df['power_usage'].std()
                return float(mean), float(std if not pd.isna(std) else 0.0)
        
        # Fallback to general stats if device is unknown but we have some data
        if not self.df.empty:
             return self.df['power_usage'].mean(), self.df['power_usage'].std()

        return 5.0, 1.0 # Hard fallback

    def _get_today(self):
        return datetime.now().date()
    
    def update_config(self, key, value):
        if key == 'std_multiplier':
            try:
                self.std_multiplier = float(value)
                print(f"INFO: Updated std_multiplier to {self.std_multiplier}")
            except ValueError:
                print(f"ERROR: Invalid value for std_multiplier: {value}")

    def analyze_current_usage(self, device, current_usage):
        """
        Analyzes usage and provides recommendations.
        Restores today's usage to 0 at the start of each day by subtracting 
         the energy recorded at midnight.
        """
        today = self._get_today()
        
        # 1. Update/Restore the daily baseline if needed
        # We only need to fetch this once per day (or periodically)
        if self.last_baseline_date != today:
            try:
                print(f"INFO: Fetching energy baseline for {today}...")
                first_reading = firebase_service.get_first_reading_of_day()
                if first_reading:
                    self.midnight_energy_offset = float(first_reading.get('pzem', {}).get('energy', 0.0))
                    self.last_baseline_date = today
                    print(f"INFO: Today's energy baseline reset to {self.midnight_energy_offset} kWh")
                else:
                    # If no data for today yet, we might want to retry later
                    # For now, we'll keep the last offset or 0
                    print(f"WARN: No reading found for today yet. Using offset: {self.midnight_energy_offset}")
                    # We don't update last_baseline_date so it retries next time
            except Exception as e:
                print(f"ERROR: Failed to get baseline from Firebase: {e}")

        # 2. Subtract baseline to get actual usage today
        # Ensure we don't go below 0 (in case of sensor reset or jitter)
        actual_today_usage = max(0.0, current_usage - self.midnight_energy_offset)

        # Default response if no stats
        result = {
            "device": device,
            "current_usage": round(actual_today_usage, 4), # Return the "Restored" value
            "status": "unknown",
            "message": "No historical data for this device.",
            "historical_mean": 0.0,
            "std_dev": 0.0
        }

        mean, std = self.get_stats_for_device(device)
        
        # Output the exact stats for frontend usage logic
        result["historical_mean"] = round(mean, 2)
        result["std_dev"] = round(std, 2)
        
        # Adjust thresholds by multiplier
        effective_std = (std if std > 0 else 0.5) * self.std_multiplier
        high_threshold = mean + effective_std
        
        if actual_today_usage > high_threshold:
            result["status"] = "alert"
            result["message"] = f"High usage detected! Exceeds {high_threshold:.2f} kWh today."
        else:
            result["status"] = "normal"
            result["message"] = "Usage is within normal range."
            
        return result

    def get_forecast(self):
        if self.models.model is None or self.df.empty:
            return {"today": 0, "tomorrow": 0, "error": "Model or Data missing"}

        today = self._get_today()
        # Future DF for prophet
        future_dates = pd.date_range(start=today, periods=2, freq='D')
        future = pd.DataFrame({'ds': future_dates})

        # Get last known temp
        if 'temperature' in self.df.columns and not self.df.empty:
            last_temp = self.df.groupby('date')['temperature'].mean().iloc[-1]
        else:
            last_temp = 25.0 # default

        # Scale
        if self.models.scaler:
            try:
                future['temp'] = self.models.scaler.transform([[last_temp]])[0][0]
            except:
                 future['temp'] = 0 # Fallback
        else:
             future['temp'] = 0

        # Predict
        try:
            forecast = self.models.model.predict(future)
            # Take the yhat values
            today_pred = float(forecast.iloc[0]['yhat'])
            tomorrow_pred = float(forecast.iloc[1]['yhat'])
            
            # --- Robustness Check ---
            # If the model gives garbage results (common with sparse real data),
            # fallback to historical mean.
            historical_mean = self.df['power_usage'].mean() if not self.df.empty else 5.0
            
            if today_pred < 0 or today_pred > 100:
                today_pred = historical_mean
            if tomorrow_pred < 0 or tomorrow_pred > 100:
                tomorrow_pred = historical_mean
                
            today_pred = round(today_pred, 2)
            tomorrow_pred = round(tomorrow_pred, 2)
            
        except Exception as e:
            print(f"Forecast Error: {e}")
            historical_mean = self.df['power_usage'].mean() if not self.df.empty else 5.0
            tomorrow_pred = round(historical_mean, 2)
            today_pred = round(historical_mean, 2)

        # Get projected today if we have actual data, else fallback to model prediction for today
        if not self.df.empty:
            try:
                from .config import PARTIAL_FACTOR
                actual_today_sum = self.df[self.df['date'].dt.date == today]['power_usage'].sum()
                
                # If we have actual data for today, project it
                if actual_today_sum > 0:
                    projected_today = round(actual_today_sum / PARTIAL_FACTOR, 2)
                else:
                    projected_today = today_pred
            except:
                projected_today = today_pred
        else:
            projected_today = today_pred

        return {
            "today": projected_today,
            "tomorrow": tomorrow_pred
        }

    def get_top_devices(self):
        """Get the top devices by usage for today. 
        Tries live database query first, then falls back to cached historical data.
        """
        try:
            from app.database import get_collection
            coll = get_collection('sensor_readings')
            if coll is not None:
                # We need to use aware datetime to match the DB
                today_start = datetime.combine(self._get_today(), datetime.min.time()).replace(tzinfo=timezone.utc)
                
                # Live aggregation for today's power readings
                pipeline = [
                    {"$match": {
                        "timestamp": {"$gte": today_start},
                        "voltage": {"$gt": 100, "$lt": 300},
                        "current": {"$gt": 0, "$lt": 100}
                    }},
                    {"$project": {
                        "device": "$device_id",
                        "power": {"$multiply": ["$voltage", "$current"]}
                    }},
                    {"$group": {
                        "_id": "$device",
                        "avg_power": {"$avg": "$power"}
                    }},
                    {"$project": {
                        "device": "$_id",
                        "usage": {"$divide": [{"$multiply": ["$avg_power", 24]}, 1000]}
                    }}
                ]
                live_records = list(coll.aggregate(pipeline))
                if live_records:
                    return {r['device']: round(r['usage'], 2) for r in live_records}
        except Exception as e:
            print(f"WARN: Live top devices query failed: {e}")

        if self.df.empty:
            return {}
        
        today = self._get_today()
        today_df = self.df[self.df['date'].dt.date == today].copy()
        
        if today_df.empty and not self.df.empty:
            latest_date = self.df['date'].max()
            today_df = self.df[self.df['date'] == latest_date].copy()

        if today_df.empty:
            return {}

        top_devices = (
            today_df.groupby('device')['power_usage']
            .sum()
            .nlargest(5)
            .round(2)
            .to_dict()
        )
        return top_devices

    def generate_recommendations(self, top_devices):
        if not self.models.device_stats is None: 
            stats_df = self.models.device_stats
        else:
            return []

        recs = []
        rec_levels = self.models.recommendation_levels
        base_recs = self.models.base_recommendations

        for device, usage in top_devices.items():
            # Get stats for this device
            mean, std = self.get_stats_for_device(device)
            
            # Use the multiplier
            effective_std = (std if std > 0 else 0.5) * self.std_multiplier
            
            low = mean - effective_std
            high = mean + effective_std

            # Simplified logic based on adjusted thresholds
            # Note: Original logic had 3 levels suitable for < low, < high, > high
            # We keep that but use the adjusted std
            
            if usage <= low:
                level_conf = rec_levels[0]
            elif usage <= high:
                level_conf = rec_levels[1]
            else:
                level_conf = rec_levels[2]

            tip = base_recs.get(device, "Monitor usage for potential savings.")
            level_desc = level_conf.get('description', f"Usage is {level_conf['level']}.")
            
            recs.append({
                "device": device,
                "usage_kwh": usage,
                "level": level_conf['level'],
                "recommendation": f"{level_desc} {tip}".strip()
            })

        return recs
