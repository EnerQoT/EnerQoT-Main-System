import pickle
import numpy as np
import pandas as pd
import os
from flask import current_app

class SensorHealthService:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.threshold = 60.0  # Default fallback
        self._load_model()

    def _load_model(self):
        try:
            # CORRECTED: Changed filename to exactly match the export script
            model_path = os.path.join(os.getcwd(), 'model_artifacts', 'sensor_health_model _IF.pkl')
            with open(model_path, 'rb') as f:
                bundle = pickle.load(f)
                self.model = bundle["model"]
                self.scaler = bundle["scaler"]
                self.feature_names = bundle["feature_names"]
                self.threshold = bundle.get("threshold", 60.0) # Extract the threshold
            print("Sensor Health Model loaded successfully!")
        except FileNotFoundError:
            print("Error: 'sensor_health_model_IF.pkl' not found.")
        except Exception as e:
            print(f"Error loading sensor health model: {e}")

    def get_ai_score(self, json_data):
        if not self.model or not self.scaler:
             return None, None, "Model not loaded"

        try:
            #  Added missing 'system.reconnects' and aligned order
            input_data = {
                'pzem.voltage': float(json_data['pzem']['voltage']),
                'ina3221.battery.voltage': float(json_data['ina3221']['battery']['voltage']),
                'ina3221.battery.current_ma': float(json_data['ina3221']['battery']['current_ma']),
                'ina3221.esp.voltage': float(json_data['ina3221']['esp']['voltage']),
                'ina3221.esp.current_ma': float(json_data['ina3221']['esp']['current_ma']),
                'ina3221.main.voltage': float(json_data['ina3221']['main']['voltage']),
                'ina3221.main.current_ma': float(json_data['ina3221']['main']['current_ma']),
                'si7021.temperature': float(json_data['si7021']['temperature']),
                'si7021.humidity': float(json_data['si7021']['humidity']),
                'system.cpu_temp': float(json_data['system']['cpu_temp']),
                'system.free_heap': float(json_data['system']['free_heap']),
                'system.rssi': float(json_data['system']['rssi']),
                'system.reconnects': float(json_data['system']['reconnects']) # ADDED
            }
        except KeyError as e:
            return None, None, f"Missing data field: {e}"
        except (ValueError, TypeError) as e:
             return None, None, f"Invalid data format: {e}"

        #  Enforce exact column order from the trained model
        df = pd.DataFrame([input_data])[self.feature_names]
        
        try:
            # Scale Data
            data_scaled = self.scaler.transform(df)
            
            # Predict (Raw Score -> 0-100)
            raw_score = self.model.decision_function(data_scaled)[0]
            
            # Use numpy's clip to match the exact formula exported in the bundle
            health_score = float(np.clip(50 + (raw_score * 100), 0, 100))
            
            # ADDED: Flag as anomaly if it drops below the bundle threshold (60.0)
            is_anomaly = health_score < self.threshold
            
            return round(health_score, 1), is_anomaly, None
            
        except Exception as e:
            return None, None, f"Prediction error: {e}"

sensor_health_service = SensorHealthService()