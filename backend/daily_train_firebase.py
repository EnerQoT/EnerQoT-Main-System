import os
import logging
import pandas as pd
import numpy as np
import shutil
from datetime import datetime, timedelta
from dotenv import load_dotenv
import warnings
import joblib

# Load environment variables
load_dotenv()

# Optional: suppress Prophet warnings for cleaner logs
warnings.filterwarnings('ignore')

import firebase_admin
from firebase_admin import credentials, db
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------
# You can override these using environment variables
FIREBASE_DB_URL = os.getenv("FIREBASE_DATABASE_URL", "https://your-project.firebaseio.com")
FIREBASE_CERT_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "config/serviceAccountKey.json")
FIREBASE_READINGS_PATH = os.getenv("FIREBASE_READINGS_PATH", "sensor_data")

OUTPUT_DIR = os.getenv("MODELS_OUTPUT_DIR", "model_artifacts")
LOGS_DIR = os.getenv("LOGS_DIR", "logs")
PARTIAL_FACTOR = 0.7  # For today's partial data projection

# Setup Logging
os.makedirs(LOGS_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOGS_DIR, "daily_training.log"))
    ]
)
logger = logging.getLogger(__name__)

# Base Recommendations Config
BASE_RECOMMENDATIONS = {
    'AC': 'set your air conditioner to 78°F or higher and maintain it regularly.',
    'Lights': 'replace incandescent bulbs with LED bulbs and use timers or dimmers.',
    'Fridge': 'set refrigerator to 37-40°F and freezer to 0-5°F, and avoid keeping the door open for long.',
    'TV': 'turn off or unplug your TV when not in use and lower the screen\'s brightness.'
}

RECOMMENDATION_LEVELS = [
    {"level": "Low", "description": "Usage is minimal or highly optimized."},
    {"level": "Normal", "description": "Usage is within expected bounds."},
    {"level": "High", "description": "Usage is significantly higher than historical mean."}
]

# -----------------------------------------------------------------------------
# DATA FETCHING
# -----------------------------------------------------------------------------
def fetch_firebase_data():
    """
    Connects to Firebase Realtime Database and pulls historical IoT sensor data.
    Returns a Pandas DataFrame formatted identically to the local CSV approach.
    """
    logger.info("Connecting to Firebase...")
    try:
        if not firebase_admin._apps:
            if not os.path.exists(FIREBASE_CERT_PATH):
                raise FileNotFoundError(f"Firebase certificate not found at {FIREBASE_CERT_PATH}")
            cred = credentials.Certificate(FIREBASE_CERT_PATH)
            firebase_admin.initialize_app(cred, {
                'databaseURL': FIREBASE_DB_URL
            })
    except Exception as e:
        logger.error(f"Failed to initialize Firebase app: {e}")
        raise
        
    logger.info(f"Fetching data from path: {FIREBASE_READINGS_PATH}...")
    ref = db.reference(FIREBASE_READINGS_PATH)
    data = ref.get()
    
    if not data:
        raise ValueError(f"No data found at Firebase path: {FIREBASE_READINGS_PATH}")
        
    records = []
    # Actual structure: sensor_data/{push_id} -> { "pzem": {...}, "si7021": {...}, "timestamp": "..." }
    for push_id, reading in data.items():
        if isinstance(reading, dict):
            pzem = reading.get("pzem", {})
            si7021 = reading.get("si7021", {})
            ts_str = reading.get("timestamp")
            
            if ts_str:
                try:
                    # Parse timestamp and strip timezone (Prophet doesn't support tz-aware dates)
                    dt = pd.to_datetime(ts_str)
                    if dt.tzinfo is not None:
                        dt = dt.tz_localize(None)
                    parsed_date = dt.normalize() 
                    
                    # Map actual fields: power from pzem, temperature from si7021
                    power_val = pzem.get("power", 0.0)
                    temp_val = si7021.get("temperature", 0.0)
                    
                    records.append({
                        "date": parsed_date,
                        "device": "main_grid", # Single device in this structure
                        "power_usage": float(power_val),
                        "temperature": float(temp_val)
                    })
                except Exception:
                    continue
                        
    df = pd.DataFrame(records)
    if df.empty:
        raise ValueError("Firebase data was pulled but resulted in an empty DataFrame.")
        
    df['date'] = pd.to_datetime(df['date'])
    return df

# -----------------------------------------------------------------------------
# MODEL TRAINING PIPELINE
# -----------------------------------------------------------------------------
def main():
    logger.info("=== Daily Firebase Model Training Started ===")
    
    # 1. Ensure output directories exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    versions_dir = os.path.join(OUTPUT_DIR, "versions")
    os.makedirs(versions_dir, exist_ok=True)
    logger.info(f"Output directory initialized: {OUTPUT_DIR}")

    # 2. Fetch Data
    try:
        df = fetch_firebase_data()
        logger.info(f"Data fetched successfully. Total records: {len(df)}")
    except Exception as e:
        logger.error(f"Data fetching failed: {e}")
        return

    today = df['date'].max()
    logger.info(f"Dataset date range: {df['date'].min().date()} to {today.date()}")
    logger.info(f"Unique dates found: {df['date'].dt.date.unique()}")

    # 3. Aggregate Data for Prophet
    logger.info("Aggregating daily data for Prophet...")
    daily_df = df.groupby('date')['power_usage'].sum().reset_index()
    daily_temp = df.groupby('date')['temperature'].mean().reset_index()

    daily_df = daily_df.merge(daily_temp, on='date')
    daily_df = daily_df.rename(columns={'date': 'ds', 'power_usage': 'y', 'temperature': 'temp'})
    
    logger.info(f"Daily aggregated data:\n{daily_df}")

    # 4. Scale Regressors
    logger.info("Scaling temperature regressor...")
    scaler = StandardScaler()
    daily_df['temp'] = scaler.fit_transform(daily_df[['temp']])

    # 5. Train Model
    logger.info("Configuring Prophet model...")
    model = Prophet(
        daily_seasonality=True,
        yearly_seasonality=True,
        weekly_seasonality=True,
        seasonality_mode='multiplicative'
    )
    model.add_regressor('temp')
    
    train_df = daily_df[daily_df['ds'] < today]
    if len(train_df) < 30:
        logger.warning("Insufficient historical data (ds < today). Including 'today' in training set for testing purposes.")
        train_df = daily_df
        
    if len(train_df) < 30:
        logger.warning("Still insufficient data to train Prophet model (needs at least 30 days). Exiting.")
        return

    logger.info("Fitting Prophet model on historical data...")
    model.fit(train_df)

    # 6. Evaluation against Baseline
    logger.info("Evaluating model against baseline...")
    train_forecast = model.predict(train_df[['ds', 'temp']])
    mae_train = mean_absolute_error(train_df['y'], train_forecast['yhat'])
    rmse_train = np.sqrt(mean_squared_error(train_df['y'], train_forecast['yhat']))
    
    # Historical Mean Baseline
    mean_baseline = train_df['y'].mean()
    baseline_predictions = np.full(len(train_df), mean_baseline)
    mae_baseline = mean_absolute_error(train_df['y'], baseline_predictions)
    rmse_baseline = np.sqrt(mean_squared_error(train_df['y'], baseline_predictions))
    
    logger.info(f"MAE:  {mae_train:.2f} kWh")
    logger.info(f"RMSE: {rmse_train:.2f} kWh")

    is_better_than_baseline = mae_train < mae_baseline
    logger.info(f"Model beats baseline? {'Yes' if is_better_than_baseline else 'No'}")

    # 7. Predictions
    logger.info("Generating predictions for today and tomorrow...")
    future_dates = pd.date_range(start=today, periods=2, freq='D')
    future = pd.DataFrame({'ds': future_dates})
    
    last_temp_scaled = daily_df['temp'].iloc[-1]
    future['temp'] = last_temp_scaled

    forecast = model.predict(future)

    actual_today_partial = df[df['date'] == today]['power_usage'].sum()
    projected_today_total = actual_today_partial / PARTIAL_FACTOR

    logger.info("=== PREDICTIONS ===")
    logger.info(f"Today ({today.date()}): {projected_today_total:.2f} kWh (projected)")
    logger.info(f"Tomorrow ({(today + timedelta(days=1)).date()}): {forecast.iloc[1]['yhat']:.2f} kWh")

    # 8. Top Devices & Recommendations
    today_df = df[df['date'] == today].copy()
    today_df['projected_usage'] = today_df['power_usage'] / PARTIAL_FACTOR
    today_devices = today_df.groupby('device')['projected_usage'].sum().nlargest(5)

    historical_df = df[df['date'] < today]
    device_stats = historical_df.groupby('device')['power_usage'].agg(['mean', 'std']).reset_index()

    logger.info("=== TOP 5 DEVICES TODAY (PROJECTED) ===")
    for dev, val in today_devices.items():
        logger.info(f"{dev}: {val:.2f} kWh")

    logger.info("=== ENERGY SAVING RECOMMENDATIONS ===")
    for device, projected_usage in today_devices.items():
        stats = device_stats[device_stats['device'] == device]
        if not stats.empty:
            mean_val = stats['mean'].values[0]
            std_val = stats['std'].values[0]
            
            if pd.isna(std_val):
                std_val = 0.0
                
            low_thresh = mean_val - std_val
            high_thresh = mean_val + std_val

            if projected_usage <= low_thresh:
                level = 'Low'
            elif projected_usage <= high_thresh:
                level = 'Normal'
            else:
                level = 'High'

            logger.info(f"- **{device}**: {projected_usage:.2f} kWh -> {level} usage")

    # 9. Save Artifacts with Versioning
    logger.info("Saving model and artifacts...")
    try:
        # Save as a versioned model
        version_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        versioned_model_path = os.path.join(versions_dir, f"prophet_energy_model_v{version_str}.pkl")
        best_model_path = os.path.join(OUTPUT_DIR, "prophet_energy_model.pkl")
        fallback_model_path = os.path.join(OUTPUT_DIR, "prophet_energy_model_fallback.pkl")

        joblib.dump(model, versioned_model_path)
        logger.info(f"Saved versioned model to {versioned_model_path}")

        # Update best model if it performs better than baseline
        if is_better_than_baseline or not os.path.exists(best_model_path):
            if os.path.exists(best_model_path):
                shutil.copy(best_model_path, fallback_model_path)
                logger.info("Backed up previous best model to fallback.")
            
            joblib.dump(model, best_model_path)
            logger.info("Updated best model (prophet_energy_model.pkl)")
        else:
            logger.info("New model did not beat baseline. Kept previous best model active.")
        
        # Save other artifacts (can overwrite safely)
        joblib.dump(scaler, os.path.join(OUTPUT_DIR, "temperature_scaler.pkl"))
        joblib.dump(device_stats, os.path.join(OUTPUT_DIR, "device_stats.pkl"))
        joblib.dump(BASE_RECOMMENDATIONS, os.path.join(OUTPUT_DIR, "base_recommendations.pkl"))
        joblib.dump(RECOMMENDATION_LEVELS, os.path.join(OUTPUT_DIR, "recommendation_levels.pkl"))
        
        logger.info(f"All models and artifacts successfully saved.")
    except Exception as e:
        logger.error(f"Failed to save artifacts: {e}")

if __name__ == "__main__":
    main()
