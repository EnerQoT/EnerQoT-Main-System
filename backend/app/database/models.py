"""
Database Models for MongoDB Collections
Defines document structures and helper methods
"""

from datetime import datetime, timezone
from bson import ObjectId


class SensorReading:
    """Sensor reading document model"""

    @staticmethod
    def create(device_id, voltage, current, frequency, temperature, power_factor, ina3221=None, system=None, pzem=None, si7021=None):
        """Create a sensor reading document"""
        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc),
            "voltage": float(voltage),
            "current": float(current),
            "frequency": float(frequency),
            "temperature": float(temperature),
            "power_factor": float(power_factor),
            "ina3221": ina3221 or {},
            "system": system or {},
            "pzem": pzem or {},
            "si7021": si7021 or {},
            "created_at": datetime.now(timezone.utc)
        }


class Anomaly:
    """Anomaly detection result model"""

    @staticmethod
    def create(device_id, severity, anomaly_score, action_taken, features=None,
               iforest_score=None, dqn_confidence=None, rl_action=None, scoring_mode=None):
        """
        Create an anomaly document.

        Now includes hybrid model metadata:
          - iforest_score:    float — raw Isolation Forest score
          - dqn_confidence:   float — DQN softmax probability of anomaly
          - rl_action:        int   — DQN final action (0=Normal, 1=Anomaly)
          - scoring_mode:     str   — "hybrid" | "iforest_only"
        """
        # Convert features to serializable form
        if features is None:
            features_dict = {}
        elif hasattr(features, 'tolist'):
            features_dict = {"values": features.tolist()}
        elif isinstance(features, dict):
            features_dict = features
        else:
            features_dict = {}

        doc = {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc),
            "severity": severity,
            "anomaly_score": float(anomaly_score),
            "action_taken": action_taken,
            "features": features_dict,
            "created_at": datetime.now(timezone.utc)
        }

        # Hybrid model metadata (optional, present when RL model is loaded)
        if iforest_score is not None:
            doc["iforest_score"] = float(iforest_score)
        if dqn_confidence is not None:
            doc["dqn_confidence"] = float(dqn_confidence)
        if rl_action is not None:
            doc["rl_action"] = int(rl_action)
        if scoring_mode is not None:
            doc["scoring_mode"] = scoring_mode

        return doc


class Notification:
    """Notification/Alert model"""

    @staticmethod
    def create(device_id, severity, title, message, action="None"):
        """Create a notification document"""
        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc),
            "severity": severity,
            "title": title,
            "message": message,
            "action": action,
            "read": False,
            # Feedback fields (populated when user responds)
            "feedback_type": None,        # "confirm" | "false_alarm" | None
            "feedback_submitted_at": None,
            "created_at": datetime.now(timezone.utc)
        }


class User:
    """User profile model"""

    @staticmethod
    def create(name, email, role="user"):
        """Create a user document"""
        return {
            "name": name,
            "email": email,
            "role": role,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        }


class UserFeedback:
    """User feedback for online DQN learning"""

    @staticmethod
    def create(device_id, correct_label, feedback_type=None, notification_id=None,
               original_prediction=None, original_score=None, features_snapshot=None,
               user_id=None):
        """
        Create a feedback document.

        Args:
            device_id:            str  — device that generated the anomaly
            correct_label:        int  — 0=Normal, 1=Anomaly
            feedback_type:        str  — "confirm" | "false_alarm"
            notification_id:      str  — linked notification MongoDB ObjectId
            original_prediction:  str  — what the model predicted ("WARNING", "CRITICAL", etc.)
            original_score:       float — model's combined anomaly score at time of alert
            features_snapshot:    list  — feature vector at time of alert (for replay)
            user_id:              str  — optional user who gave feedback
        """
        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc),
            "correct_label": int(correct_label),
            "feedback_type": feedback_type,           # "confirm" or "false_alarm"
            "notification_id": notification_id,       # Link back to notification
            "original_prediction": original_prediction,
            "original_score": float(original_score) if original_score is not None else None,
            "features_snapshot": features_snapshot,   # Enables offline replay later
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc)
        }


class Device:
    """Device metadata model"""

    @staticmethod
    def create(device_id, name, location="Unknown", device_type="sensor"):
        """Create a device document"""
        return {
            "device_id": device_id,
            "name": name,
            "location": location,
            "type": device_type,
            "status": "active",
            "smart_agent_enabled": True,
            "created_at": datetime.now(timezone.utc)
        }


class DailyUsage:
    """Daily energy usage documentation model"""
    
    @staticmethod
    def create(device_id, date, total_kwh, cost=0.0):
        """Create a daily usage document"""
        return {
            "device_id": device_id,
            "date": date,
            "total_kwh": float(total_kwh),
            "cost": float(cost),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }


class Tip:
    """Energy saving tip model"""
    
    @staticmethod
    def create(device_id, title, description, category="general"):
        """Create a tip document"""
        return {
            "device_id": device_id,
            "title": title,
            "description": description,
            "category": category,
            "created_at": datetime.now(timezone.utc),
            "is_active": True
        }
