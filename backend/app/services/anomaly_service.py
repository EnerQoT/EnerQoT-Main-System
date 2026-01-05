from collections import deque
from datetime import datetime, timezone

from config.settings import WINDOW_SIZE
from app.models.hybrid_model import HybridAnomalyModel
from app.services.smart_agent import SmartAgent
from app.utils.feature_engineering import compute_features

class AnomalyService:
    def __init__(self):
        self.model = HybridAnomalyModel()
        self.agent = SmartAgent()
        self.buffers = {}
        self.last_features = {} # Cache for feedback

    def _severity(self, score):
        if score < 0.5:
            return "NORMAL"
        elif score < 0.6:
            return "WARNING"
        else:
            return "CRITICAL"

    def process(self, device_id, payload):
        if device_id not in self.buffers:
            self.buffers[device_id] = deque(maxlen=WINDOW_SIZE)

        self.buffers[device_id].append(payload)

        # Need full window for meaningful features? 
        # Feature engineering creates NaNs/defaults if not full, but let's wait a bit or just process.
        # User snippet uses rolling(20), so we prefer > 5 samples at least.
        if len(self.buffers[device_id]) < 5:
             # Just return buffering status, or calculate with what we have (features will be mostly NaNs/0s)
            return {
                "device_id": device_id,
                "status": "BUFFERING",
                "samples_collected": len(self.buffers[device_id])
            }

        features = compute_features(self.buffers[device_id])
        self.last_features[device_id] = features
        score = self.model.score(features)
        
        # Determine Severity
        severity = self._severity(score)
        
        # Take Action
        action_taken = self.agent.act(device_id, severity)

        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "anomaly_score": round(score, 3),
            "severity": severity,
            "action": action_taken
        }
        
    def handle_feedback(self, device_id, correct_label):
        """
        Process user feedback.
        correct_label: 0 (Normal) or 1 (Anomaly)
        """
        if device_id not in self.last_features:
            return {"status": "error", "message": "No recent data found for this device."}
            
        features = self.last_features[device_id]
        
        # Trigger Online Learning
        self.model.train_online(features, correct_label)
        
        return {
            "status": "success", 
            "message": f"Model updated for device {device_id} with label {correct_label}"
        }
