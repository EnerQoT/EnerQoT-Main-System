
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
        self._load_model()

    def _load_model(self):
        try:
            model_path = os.path.join(os.getcwd(), 'model_artifacts', 'sensor_health_model.pkl')
            with open(model_path, 'rb') as f:
                bundle = pickle.load(f)
                self.model = bundle["model"]
                self.scaler = bundle["scaler"]
                self.feature_names = bundle["feature_names"]
            print("Sensor Health Model loaded successfully!")
        except FileNotFoundError:
            print("Error: 'sensor_health_model.pkl' not found.")
       
        except Exception as e:
            print(f"Error loading sensor health model: {e}")

    def get_ai_score(self, json_data):
        if not self.model or not self.scaler:
             return None, "Model not loaded"

        # Map incoming JSON to the exact feature list used in training
        try:
            input_data = {
                'pzem.voltage': float(json_data['pzem']['voltage']),
                'ina3221.battery.voltage': float(json_data['ina3221']['battery']['voltage']),
                'ina3221.battery.current_ma': float(json_data['ina3221']['battery']['current_ma']),
                'system.rssi': float(json_data['system']['rssi']),
                'system.free_heap': float(json_data['system']['free_heap']),
                'system.cpu_temp': float(json_data['system']['cpu_temp']),
                'si7021.temperature': float(json_data['si7021']['temperature'])
            }
        except KeyError as e:
            return None, f"Missing data field: {e}"
        except (ValueError, TypeError) as e:
             return None, f"Invalid data format: {e}"

        # Convert to DataFrame
        df = pd.DataFrame([input_data])
        
        try:
            # Scale Data
            data_scaled = self.scaler.transform(df)
            
            # Predict (Raw Score -> 0-100)
            raw_score = self.model.decision_function(data_scaled)[0]
            health_score = 50 + (raw_score * 100)
            
            # Clamp between 0 and 100
            return max(0, min(100, round(health_score, 1))), None
        except Exception as e:
            return None, f"Prediction error: {e}"

sensor_health_service = SensorHealthService()
