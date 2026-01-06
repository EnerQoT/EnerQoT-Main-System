"""
Database Models for MongoDB Collections
Defines document structures and helper methods
"""

from datetime import datetime, timezone
from bson import ObjectId


class SensorReading:
    """Sensor reading document model"""
    
    @staticmethod
    def create(device_id, voltage, current, frequency, temperature, power_factor):
        """Create a sensor reading document"""
        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc),
            "voltage": float(voltage),
            "current": float(current),
            "frequency": float(frequency),
            "temperature": float(temperature),
            "power_factor": float(power_factor),
            "created_at": datetime.now(timezone.utc)
        }


class Anomaly:
    """Anomaly detection result model"""
    
    @staticmethod
    def create(device_id, severity, anomaly_score, action_taken, features=None):
        """Create an anomaly document"""
        # Convert features to dict if it's a numpy array or None
        if features is None:
            features_dict = {}
        elif hasattr(features, 'tolist'):
            # It's a numpy array, convert to list
            features_dict = {"values": features.tolist()}
        elif isinstance(features, dict):
            features_dict = features
        else:
            features_dict = {}
            
        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc),
            "severity": severity,
            "anomaly_score": float(anomaly_score),
            "action_taken": action_taken,
            "features": features_dict,
            "created_at": datetime.now(timezone.utc)
        }


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
    """User feedback for online learning"""
    
    @staticmethod
    def create(device_id, correct_label, user_id=None):
        """Create a feedback document"""
        return {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc),
            "correct_label": int(correct_label),
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
            "created_at": datetime.now(timezone.utc)
        }
