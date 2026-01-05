from collections import deque
from datetime import datetime, timezone

from app.config.settings import WINDOW_SIZE
from app.models.anomaly_model import AnomalyModel
from app.utils.feature_engineering import compute_features

class AnomalyService:
    def __init__(self):
        self.model = AnomalyModel()
        self.buffers = {}

    def _severity(self, score):
        if score < 0.6:
            return "NORMAL"
        elif score < 0.8:
            return "WARNING"
        else:
            return "CRITICAL"

    def process(self, device_id, payload):
        if device_id not in self.buffers:
            self.buffers[device_id] = deque(maxlen=WINDOW_SIZE)

        self.buffers[device_id].append(payload)

        if len(self.buffers[device_id]) < WINDOW_SIZE:
            return {
                "device_id": device_id,
                "status": "BUFFERING",
                "samples_collected": len(self.buffers[device_id])
            }

        features = compute_features(self.buffers[device_id])
        score = self.model.score(features)

        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "anomaly_score": round(score, 3),
            "severity": self._severity(score)
        }
