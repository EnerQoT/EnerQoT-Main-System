from collections import deque
from datetime import datetime, timezone, timedelta
import numpy as np

from config.settings import WINDOW_SIZE
from app.models.hybrid_model import HybridAnomalyModel
from app.services.smart_agent import SmartAgent
from app.utils.feature_engineering import compute_features
from app.database import get_collection, SensorReading, Anomaly, Notification, is_db_connected


class AnomalyService:
    def __init__(self):
        self.model = HybridAnomalyModel()
        self.agent = SmartAgent()

        # In-memory buffers for real-time processing
        self.buffers = {}
        self.last_features = {}      # 8-feature engineered (for iForest)
        self.last_raw_features = {}  # 5-feature raw (for RL DQN)
        self.latest_outputs = {}

        # Cache the last anomaly context per device for feedback linking
        # Stores: { device_id: { features, rl_action, iforest_score, dqn_confidence, combined_score, predicted_severity } }
        self.last_anomaly_context = {}

        # MongoDB collections
        self.use_db = is_db_connected()
        if self.use_db:
            self.sensor_readings = get_collection('sensor_readings')
            self.anomalies = get_collection('anomalies')
            self.notifications = get_collection('notifications')
            self.user_feedback = get_collection('user_feedback')
            print("✅ AnomalyService using MongoDB for persistence")
        else:
            print("⚠️  AnomalyService running in-memory only (no database)")

    # ------------------------------------------------------------------
    # Severity Classification
    # ------------------------------------------------------------------
    def _severity(self, score):
        """Classify anomaly score into severity level."""
        if score < 0.5:
            return "NORMAL"
        elif score < 0.65:
            return "WARNING"
        else:
            return "CRITICAL"

    # ------------------------------------------------------------------
    # Main Processing Pipeline
    # ------------------------------------------------------------------
    def process(self, device_id, payload):
        """
        Full hybrid anomaly detection pipeline:
        1. Save sensor reading to MongoDB
        2. Buffer new reading
        3. Feature engineering
        4. Hybrid scoring (iForest + DQN)
        5. Smart agent decision
        6. Persist anomaly + notification
        7. Return enriched result
        """
        # 1. Save sensor reading to MongoDB
        if self.use_db:
            try:
                reading = SensorReading.create(
                    device_id,
                    payload.get('voltage', 0),
                    payload.get('current', 0),
                    payload.get('frequency', 0),
                    payload.get('temperature', 0),
                    payload.get('power_factor', 0)
                )
                self.sensor_readings.insert_one(reading)
            except Exception as e:
                print(f"⚠️  DB Error (Sensor Write): {e}")

        # 2. Update in-memory buffer
        if device_id not in self.buffers:
            self.buffers[device_id] = deque(maxlen=WINDOW_SIZE)
        self.buffers[device_id].append(payload)

        # 3. Need minimum samples for feature engineering
        if len(self.buffers[device_id]) < 5:
            return {
                "device_id": device_id,
                "status": "BUFFERING",
                "samples_collected": len(self.buffers[device_id])
            }

        # 4. Feature engineering (8 features for iForest)
        features = compute_features(self.buffers[device_id])
        self.last_features[device_id] = features

        # 4b. Extract raw 5-feature vector for RL DQN
        #     Order: [voltage, current, frequency, power_factor, temperature]
        #     (same order as RL training dataset columns)
        raw_features = np.array([[
            payload.get('voltage', 0),
            payload.get('current', 0),
            payload.get('frequency', 0),
            payload.get('power_factor', 0),
            payload.get('temperature', 0)
        ]], dtype=np.float64)
        self.last_raw_features[device_id] = raw_features

        # 5. Get DQN output using raw 5-feature input
        rl_action, q_values = self.agent.get_dqn_output(raw_features)

        # 6. Hybrid scoring — combines iForest + DQN
        score_result = self.model.combined_score(features, dqn_q_values=q_values)
        combined = score_result["combined_score"]
        iforest_s = score_result["iforest_score"]
        dqn_conf = score_result["dqn_confidence"]
        scoring_mode = score_result["mode"]

        severity = self._severity(combined)

        # 7. Smart agent decision (routes to critical/warning based on rl_action + severity)
        action_taken = self.agent.act(device_id, severity, raw_features=raw_features)

        # 8. Cache last anomaly context per device (for feedback linkage)
        self.last_anomaly_context[device_id] = {
            "features": features,           # 8-feature engineered
            "raw_features": raw_features,   # 5-feature raw (for RL training)
            "rl_action": rl_action,
            "iforest_score": iforest_s,
            "dqn_confidence": dqn_conf,
            "combined_score": combined,
            "predicted_severity": severity,
            "scoring_mode": scoring_mode,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # 9. Persist anomaly + notification to MongoDB if not Normal
        anomaly_id = None
        if self.use_db and severity != "NORMAL":
            try:
                anomaly = Anomaly.create(
                    device_id,
                    severity,
                    combined,
                    action_taken,
                    features,
                    iforest_score=iforest_s,
                    dqn_confidence=dqn_conf,
                    rl_action=rl_action,
                    scoring_mode=scoring_mode
                )
                result = self.anomalies.insert_one(anomaly)
                anomaly_id = str(result.inserted_id)

                # Create notification
                title = f"{severity} Alert"
                message = self._get_alert_message(severity, payload, score_result)
                notification = Notification.create(
                    device_id,
                    severity,
                    title,
                    message,
                    action_taken
                )
                self.notifications.insert_one(notification)
            except Exception as e:
                print(f"⚠️  DB Error (Anomaly Write): {e}")

        # 10. Prepare and cache result
        result = {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "anomaly_score": round(combined, 3),
            "iforest_score": round(iforest_s, 3),
            "dqn_confidence": round(dqn_conf, 3),
            "rl_action": rl_action,
            "severity": severity,
            "scoring_mode": scoring_mode,
            "action": action_taken
        }
        if anomaly_id:
            result["anomaly_id"] = anomaly_id

        self.latest_outputs[device_id] = result
        return result

    # ------------------------------------------------------------------
    # Alert Message Generation
    # ------------------------------------------------------------------
    def _get_alert_message(self, severity, payload, score_result=None):
        """Generate a detailed, informative alert message."""
        mode = score_result.get("mode", "unknown") if score_result else "unknown"
        mode_label = "Hybrid AI" if mode == "hybrid" else "Isolation Forest"

        if payload.get('temperature', 0) > 50:
            cause = "High temperature detected"
        elif payload.get('voltage', 0) > 250:
            cause = "Voltage spike detected"
        elif payload.get('current', 0) > 15:
            cause = "High current detected"
        elif payload.get('power_factor', 0) < 0.6:
            cause = "Low power factor detected"
        else:
            cause = f"{severity} anomaly pattern detected"

        dqn_part = ""
        if score_result and score_result.get("dqn_confidence", 0) > 0:
            dqn_part = f" DQN confidence: {score_result['dqn_confidence']*100:.0f}%."

        return f"[{mode_label}] {cause}.{dqn_part} Please inspect device."

    # ------------------------------------------------------------------
    # Feedback Processing (Online Learning)
    # ------------------------------------------------------------------
    def handle_feedback(self, device_id, correct_label, feedback_type=None,
                        notification_id=None, correct_severity=None):
        """
        Process user feedback to trigger online DQN learning.

        Args:
            device_id:        str  -- e.g. "test_device_01"
            correct_label:    int  -- 0=Normal/FalseAlarm, 1=Anomaly/Confirmed
            feedback_type:    str  -- "confirm" | "false_alarm" | None
            notification_id:  str  -- MongoDB ObjectId of the related notification
            correct_severity: str  -- "NORMAL" | "WARNING" | "CRITICAL"
                                      (the severity the user says it SHOULD have been)

        Returns:
            dict with status, training stats, and model update info
        """
        if device_id not in self.last_features:
            return {
                "status": "error",
                "message": "No recent sensor data found for this device. "
                           "Send sensor data first before submitting feedback."
            }

        # Use raw 5-feature vector for RL training
        raw_features = self.last_raw_features.get(device_id)
        context = self.last_anomaly_context.get(device_id, {})

        # Infer feedback_type from correct_label if not provided
        if feedback_type is None:
            feedback_type = "confirm" if correct_label == 1 else "false_alarm"

        # Map correct_severity to correct_label if provided
        # (overrides the passed correct_label for more precise signal)
        if correct_severity:
            correct_severity = correct_severity.upper()
            if correct_severity == "NORMAL":
                correct_label = 0
            else:  # WARNING or CRITICAL both map to anomaly action
                correct_label = 1

        # Trigger online DQN training with raw features + severity context
        train_result = self.agent.train_online(
            raw_features, correct_label, feedback_type=feedback_type,
            correct_severity=correct_severity
        )

        # Persist feedback record to MongoDB
        if self.use_db:
            try:
                from app.database.models import UserFeedback
                feedback_doc = UserFeedback.create(
                    device_id=device_id,
                    correct_label=correct_label,
                    feedback_type=feedback_type,
                    notification_id=notification_id,
                    original_prediction=context.get("predicted_severity"),
                    original_score=context.get("combined_score"),
                    features_snapshot=context.get("features").tolist() if context.get("features") is not None else None
                )
                self.user_feedback.insert_one(feedback_doc)
            except Exception as e:
                print(f"⚠️  DB Error (Feedback Write): {e}")

        stats = self.agent.get_training_stats()
        return {
            "status": "success",
            "message": f"DQN brain updated via '{feedback_type}' feedback for device {device_id}.",
            "model_updated": train_result.get("success", False),
            "model_saved": train_result.get("model_saved", False),
            "was_model_correct": train_result.get("was_model_correct"),
            "replay_trained": train_result.get("replay_trained", False),
            "correct_severity": train_result.get("correct_severity"),
            "reward_applied": train_result.get("reward_applied"),
            "training_stats": stats
        }

    # ------------------------------------------------------------------
    # Status & Data Methods
    # ------------------------------------------------------------------
    def get_latest_status(self, device_id=None):
        """Get latest status from MongoDB or in-memory cache."""
        if self.use_db and device_id:
            try:
                latest_reading = self.sensor_readings.find_one(
                    {"device_id": device_id},
                    sort=[("timestamp", -1)]
                )

                if latest_reading:
                    latest_anomaly = self.anomalies.find_one(
                        {"device_id": device_id},
                        sort=[("timestamp", -1)]
                    )

                    is_related_anomaly = False
                    if latest_anomaly:
                        reading_time = latest_reading.get('timestamp')
                        anomaly_time = latest_anomaly.get('timestamp')

                        if reading_time.tzinfo is None:
                            reading_time = reading_time.replace(tzinfo=timezone.utc)
                        if anomaly_time.tzinfo is None:
                            anomaly_time = anomaly_time.replace(tzinfo=timezone.utc)

                        time_diff = abs((reading_time - anomaly_time).total_seconds())
                        if time_diff < 5.0:
                            is_related_anomaly = True

                    response = {
                        "device_id": device_id,
                        "data": {
                            "voltage": latest_reading.get('voltage'),
                            "current": latest_reading.get('current'),
                            "frequency": latest_reading.get('frequency'),
                            "temperature": latest_reading.get('temperature'),
                            "power_factor": latest_reading.get('power_factor')
                        },
                        "timestamp": latest_reading.get('timestamp').isoformat()
                            if latest_reading.get('timestamp')
                            else datetime.now(timezone.utc).isoformat()
                    }

                    if latest_anomaly and is_related_anomaly:
                        response["severity"] = latest_anomaly.get("severity", "NORMAL")
                        response["anomaly_score"] = latest_anomaly.get("anomaly_score", 0)
                        response["iforest_score"] = latest_anomaly.get("iforest_score", 0)
                        response["dqn_confidence"] = latest_anomaly.get("dqn_confidence", 0)
                        response["rl_action"] = latest_anomaly.get("rl_action", 0)
                        response["scoring_mode"] = latest_anomaly.get("scoring_mode", "unknown")
                        response["action"] = latest_anomaly.get("action_taken", "None")
                    else:
                        response["severity"] = "NORMAL"
                        response["anomaly_score"] = 0
                        response["iforest_score"] = 0
                        response["dqn_confidence"] = 0
                        response["rl_action"] = 0
                        response["scoring_mode"] = "unknown"
                        response["action"] = "None"

                    return response
            except Exception as e:
                print(f"⚠️  DB Error (Status Read): {e}")

        # Fallback to in-memory cache
        if device_id and device_id in self.latest_outputs:
            return self.latest_outputs[device_id]

        return None

    def get_system_stats(self):
        """Get aggregated system statistics for admin dashboard."""
        if not self.use_db:
            return {
                "total_devices": 1,
                "active_devices": 1,
                "total_anomalies_24h": 0,
                "system_health": 100
            }

        devices_col = get_collection('devices')
        total_devices = devices_col.count_documents({})
        active_devices = devices_col.count_documents({"status": "active"})

        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        recent_anomalies = self.anomalies.count_documents({
            "timestamp": {"$gte": yesterday}
        })

        inactive = total_devices - active_devices
        health_score = max(0, 100 - (recent_anomalies * 2) - (inactive * 5))

        # Append agent training stats
        agent_stats = self.agent.get_training_stats()

        return {
            "total_devices": total_devices,
            "active_devices": active_devices,
            "total_anomalies_24h": recent_anomalies,
            "system_health": health_score,
            "agent_stats": agent_stats
        }

    def get_all_devices(self):
        """Get list of all devices with detailed status."""
        if not self.use_db:
            return []

        devices_col = get_collection('devices')
        devices = list(devices_col.find({}, {"_id": 0}))

        enriched_devices = []
        for d in devices:
            device_id = d.get("device_id")

            last_reading = self.sensor_readings.find_one(
                {"device_id": device_id},
                sort=[("timestamp", -1)]
            )

            active_alert_count = self.anomalies.count_documents({
                "device_id": device_id,
                "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)},
                "severity": {"$ne": "NORMAL"}
            })

            d["last_active"] = last_reading["timestamp"].isoformat() if last_reading else None
            d["active_alerts"] = active_alert_count

            is_online = False
            if last_reading:
                last_seen = last_reading["timestamp"]
                if last_seen.tzinfo is None:
                    last_seen = last_seen.replace(tzinfo=timezone.utc)
                if (datetime.now(timezone.utc) - last_seen).total_seconds() < 300:
                    is_online = True

            d["status"] = "online" if is_online else "offline"
            enriched_devices.append(d)

        return enriched_devices

    def get_historical_data(self, device_id, time_range='1h'):
        """Get historical sensor data based on time range."""
        if not self.use_db:
            return []

        time_deltas = {
            '20s': timedelta(seconds=20),
            '1m': timedelta(minutes=1),
            '5m': timedelta(minutes=5),
            '15m': timedelta(minutes=15),
            '1h': timedelta(hours=1),
            '5h': timedelta(hours=5),
            '1d': timedelta(days=1),
            'week': timedelta(days=7),
            'month': timedelta(days=30),
            'year': timedelta(days=365)
        }

        delta = time_deltas.get(time_range, timedelta(hours=1))
        start_time = datetime.now(timezone.utc) - delta

        readings = list(self.sensor_readings.find(
            {"device_id": device_id, "timestamp": {"$gte": start_time}},
            sort=[("timestamp", 1)]
        ))

        for reading in readings:
            reading['_id'] = str(reading['_id'])
            if 'timestamp' in reading:
                reading['timestamp'] = reading['timestamp'].isoformat()

        return readings

    def get_notifications(self, device_id, severity='all', limit=50):
        """Get notification history."""
        if not self.use_db:
            return []

        query = {"device_id": device_id}
        if severity != 'all':
            query["severity"] = severity.upper()

        notifications = list(self.notifications.find(
            query,
            sort=[("timestamp", -1)],
            limit=limit
        ))

        for notif in notifications:
            notif['_id'] = str(notif['_id'])
            notif['id'] = notif['_id']  # Alias for mobile app
            if 'timestamp' in notif:
                ts = notif['timestamp']
                notif['timestamp'] = ts.isoformat()
                # Human-readable time for display
                notif['time'] = ts.strftime('%b %d, %H:%M')

        return notifications

    def mark_notification_read(self, notification_id):
        """Mark notification as read."""
        if not self.use_db:
            return False

        from bson import ObjectId
        result = self.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}}
        )
        return result.modified_count > 0

    def get_anomaly_history(self, device_id, days=7):
        """Get anomaly history for reports."""
        if not self.use_db:
            return []

        start_time = datetime.now(timezone.utc) - timedelta(days=days)

        anomalies = list(self.anomalies.find(
            {"device_id": device_id, "timestamp": {"$gte": start_time}},
            sort=[("timestamp", -1)]
        ))

        for anomaly in anomalies:
            anomaly['_id'] = str(anomaly['_id'])
            if 'timestamp' in anomaly:
                anomaly['timestamp'] = anomaly['timestamp'].isoformat()

        return anomalies

    def get_device_health(self, device_id):
        """Get EnerQoT device health metrics."""
        if not self.use_db:
            return {"status": "unknown"}

        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_count = self.sensor_readings.count_documents({
            "device_id": device_id,
            "timestamp": {"$gte": one_hour_ago}
        })

        latest = self.sensor_readings.find_one(
            {"device_id": device_id},
            sort=[("timestamp", -1)]
        )

        if not latest:
            return {"status": "inactive", "message": "No data received"}

        time_since_last = datetime.now(timezone.utc) - latest['timestamp'].replace(tzinfo=timezone.utc)
        data_quality = min(100, (recent_count / 60) * 100)
        uptime = 100 if time_since_last.seconds < 60 else 50

        return {
            "status": "active" if time_since_last.seconds < 60 else "degraded",
            "sensor_status": "Active" if recent_count > 0 else "Inactive",
            "data_quality": round(data_quality, 1),
            "connection_stability": round(uptime, 1),
            "last_reading": time_since_last.seconds,
            "temperature": latest.get('temperature', 0),
            "power_supply": "AC" if latest.get('voltage', 0) > 0 else "Battery",
            "readings_per_hour": recent_count
        }
