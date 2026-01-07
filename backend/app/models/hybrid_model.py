
import joblib
import numpy as np
import os
from config.settings import IFOREST_PATH, SCALER_PATH

class HybridAnomalyModel:
    def __init__(self):
        self.load_models()

    def load_models(self):
        # Load Scaler
        if os.path.exists(SCALER_PATH):
            self.scaler = joblib.load(SCALER_PATH)
        else:
            print("Warning: Scaler not found.")
            self.scaler = None

        # Load iForest
        if os.path.exists(IFOREST_PATH):
            self.iforest = joblib.load(IFOREST_PATH)
        else:
            print("Warning: iForest model not found.")
            self.iforest = None

    def score(self, features):
        """
        Returns an anomaly score (0.0 to 1.0) based on Isolation Forest.
        features: numpy array shape (1, 8)
        """
        if self.scaler is None:
            print("ERROR: Scaler is NOT loaded. Returning 0.0 score.")
            return 0.0

        if self.iforest is None:
            return 0.0

        try:
            X_scaled = self.scaler.transform(features)
            
            # iForest Score
            # decision_function returns negative for anomalies, positive for normal
            # Standard IF: larger is better (more normal). 
            # Scikit-learn IF: decision_function < 0 is anomaly.
            # We want Score -> 1.0 (Anomaly), 0.0 (Normal)
            
            raw_score = self.iforest.decision_function(X_scaled)[0]
            
            # Raw score is roughly [-0.5, 0.5]
            # If raw < 0 => Anomaly.
            # We urge score to be high for anomaly.
            # Let's map: score = 0.5 - raw_score
            # If raw = -0.2 (Anomaly) -> 0.7
            # If raw = 0.2 (Normal) -> 0.3
            
            # Use simple negation and clip
            # anomaly_score = 0.5 - raw_score
            # Bound [0, 1]
            anomaly_score = 0.5 - raw_score
            return max(0.0, min(1.0, anomaly_score))
            
        except Exception as e:
            print(f"Error in iForest scoring: {e}")
            return 0.0

    def train_online(self, features, correct_label):
        """
        Placeholder for online learning.
        Isolation forest online updates can be complex/unsupported in std sklearn.
        """
        pass
