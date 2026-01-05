import joblib
from app.config.settings import IFOREST_PATH, SCALER_PATH

class AnomalyModel:
    def __init__(self):
        self.model = joblib.load(IFOREST_PATH)
        self.scaler = joblib.load(SCALER_PATH)

    def score(self, features):
        X_scaled = self.scaler.transform(features)
        raw_score = -self.model.decision_function(X_scaled)[0]
        anomaly_score = (raw_score + 0.5) / 1.0
        return max(0.0, min(1.0, anomaly_score))
