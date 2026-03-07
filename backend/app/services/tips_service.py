import os
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from app.services.config import MODELS_DIR as MODEL_DIR, PARTIAL_FACTOR
from app.database.connection import get_collection, is_db_connected

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
        
        # Load Data
        self.df = pd.DataFrame(columns=['date', 'power_usage', 'temperature', 'device'])
        self.refresh_data()

    def refresh_data(self):
        """Fetches the latest data from MongoDB instead of a local file."""
        if not is_db_connected():
            print("WARNING: Database not connected, running TipsService with empty data.")
            return

        readings_col = get_collection("sensor_readings")
        if readings_col is None:
            return
            
        # Get last 1000 readings
        recent_readings = list(readings_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(1000))
        if not recent_readings:
            print("INFO: No historical data in database.")
            return

        parsed_data = []
        for r in recent_readings:
            v = r.get("voltage", 230)
            i = r.get("current", 0)
            pf = r.get("power_factor", 1)
            power_watts = v * i * pf
            power_kwh = power_watts / 1000

            parsed_data.append({
                'date': r.get("timestamp"),
                'power_usage': power_kwh,
                'temperature': r.get("temperature", 25.0),
                'device': r.get("device_id", "Unknown")
            })

        self.df = pd.DataFrame(parsed_data)
        if not self.df.empty:
            self.df['date'] = pd.to_datetime(self.df['date'])

    def _get_today(self):
        # The MongoDB timestamps are natively UTC or system offset.
        # Use the latest actual date from our database dataframe to avoid false 0-value lookups over midnight.
        if not self.df.empty and 'date' in self.df.columns:
            return self.df['date'].dt.date.max()
        return datetime.now(timezone.utc).date()
    
    def update_config(self, key, value):
        if key == 'std_multiplier':
            try:
                self.std_multiplier = float(value)
                print(f"INFO: Updated std_multiplier to {self.std_multiplier}")
            except ValueError:
                print(f"ERROR: Invalid value for std_multiplier: {value}")

    def analyze_current_usage(self, device, current_usage):
        # Default response if no stats
        result = {
            "device": device,
            "current_usage": current_usage,
            "status": "unknown",
            "message": "No historical data for this device."
        }

        if self.models.device_stats is None:
            return result
            
        stats_df = self.models.device_stats
        d_stat = stats_df[stats_df['device'] == device]
        
        if d_stat.empty:
            return result
            
        mean = d_stat['mean'].values[0]
        std = d_stat['std'].values[0]
        
        # Adjust thresholds by multiplier
        effective_std = std * self.std_multiplier
        high_threshold = mean + effective_std
        
        if current_usage > high_threshold:
            result["status"] = "alert"
            result["message"] = f"High usage detected! Exceeds {high_threshold:.2f} kWh."
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

        # Get last known temp - handling empty case if needed but assuming data exists if loaded
        if 'temperature' in self.df.columns and not self.df.empty:
            last_temp = self.df.groupby('date')['temperature'].mean().iloc[-1]
        else:
            last_temp = 25.0 # default

        # Scale
        if self.models.scaler:
            try:
                # Scaler expects 2D array
                future['temp'] = self.models.scaler.transform([[last_temp]])[0][0]
            except:
                 future['temp'] = 0 # Fallback
        else:
             future['temp'] = 0

        # Predict
        try:
            forecast = self.models.model.predict(future)
            tomorrow_pred = round(forecast.iloc[1]['yhat'], 2)
        except Exception as e:
            print(f"Forecast Error: {e}")
            tomorrow_pred = 0

        # Projected today
        actual_today_sum = self.df[self.df['date'].dt.date == today]['power_usage'].sum()
        projected_today = round(actual_today_sum / PARTIAL_FACTOR, 2)

        return {
            "today": projected_today,
            "tomorrow": tomorrow_pred
        }

    def get_top_devices(self):
        if self.df.empty:
            return {}
        
        today = self._get_today()
        today_df = self.df[self.df['date'].dt.date == today].copy()
        
        if today_df.empty:
            return {}

        today_df['projected_usage'] = today_df['power_usage'] / PARTIAL_FACTOR

        top_devices = (
            today_df.groupby('device')['projected_usage']
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
            # Filter device stats
            d_stat = stats_df[stats_df['device'] == device]
            if d_stat.empty:
                continue

            mean = d_stat['mean'].values[0]
            std = d_stat['std'].values[0]
            
            # Use the multiplier
            effective_std = std * self.std_multiplier
            
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

            tip = base_recs.get(device, "Monitor usage.")
            
            recs.append({
                "device": device,
                "usage_kwh": usage,
                "level": level_conf['level'],
                "recommendation": f"{level_conf['rec_prefix']} {tip} {level_conf['rec_suffix']}".strip()
            })

        return recs
