from collections import deque
from datetime import datetime, timezone, timedelta

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
        self.last_features = {}
        self.latest_outputs = {}
        
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

    def _severity(self, score):
        if score < 0.5:
            return "NORMAL"
        elif score < 0.6:
            return "WARNING"
        else:
            return "CRITICAL"

    def process(self, device_id, payload):
        # 1. Save sensor reading to MongoDB
        if self.use_db:
            reading = SensorReading.create(
                device_id,
                payload.get('voltage', 0),
                payload.get('current', 0),
                payload.get('frequency', 0),
                payload.get('temperature', 0),
                payload.get('power_factor', 0)
            )
            self.sensor_readings.insert_one(reading)
        
        # 2. Update in-memory buffer for real-time processing
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
        
        # 4. Compute features and detect anomaly
        features = compute_features(self.buffers[device_id])
        self.last_features[device_id] = features
        score = self.model.score(features)
        severity = self._severity(score)
        action_taken = self.agent.act(device_id, severity)
        
        # 5. Save anomaly to MongoDB if not normal
        if self.use_db and severity != "NORMAL":
            anomaly = Anomaly.create(
                device_id,
                severity,
                score,
                action_taken,
                features
            )
            self.anomalies.insert_one(anomaly)
            
            # 6. Create notification
            title = f"{severity} Alert"
            message = self._get_alert_message(severity, payload)
            notification = Notification.create(
                device_id,
                severity,
                title,
                message,
                action_taken
            )
            self.notifications.insert_one(notification)
        
        # 7. Prepare result
        result = {
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "anomaly_score": round(score, 3),
            "severity": severity,
            "action": action_taken
        }
        
        self.latest_outputs[device_id] = result
        return result
    
    def _get_alert_message(self, severity, payload):
        """Generate alert message based on sensor data"""
        if payload.get('temperature', 0) > 50:
            return "High temperature detected"
        elif payload.get('voltage', 0) > 250:
            return "Voltage spike detected"
        elif payload.get('current', 0) > 15:
            return "High current detected"
        else:
            return f"{severity}: Check parameters"
        
    def handle_feedback(self, device_id, correct_label):
        """Process user feedback for online learning"""
        if device_id not in self.last_features:
            return {"status": "error", "message": "No recent data found for this device."}
        
        features = self.last_features[device_id]
        self.model.train_online(features, correct_label)
        
        # Save feedback to MongoDB
        if self.use_db:
            from app.database.models import UserFeedback
            feedback = UserFeedback.create(device_id, correct_label)
            self.user_feedback.insert_one(feedback)
        
        return {
            "status": "success", 
            "message": f"Model updated for device {device_id} with label {correct_label}"
        }

    def get_latest_status(self, device_id=None):
        """Get latest status from MongoDB or in-memory cache"""
        if self.use_db and device_id:
            # Query latest reading from MongoDB
            latest_reading = self.sensor_readings.find_one(
                {"device_id": device_id},
                sort=[("timestamp", -1)]
            )
            
            if latest_reading:
                # Get latest anomaly if exists
                latest_anomaly = self.anomalies.find_one(
                    {"device_id": device_id},
                    sort=[("timestamp", -1)]
                )
                
                # Check if the latest anomaly corresponds to the latest reading
                # If reading is newer than anomaly > 1 second, then it's a NORMAL reading (since we don't save NORMAL anomalies)
                is_related_anomaly = False
                if latest_anomaly:
                    reading_time = latest_reading.get('timestamp')
                    anomaly_time = latest_anomaly.get('timestamp')
                    
                    # If reading is local datetime, ensure timezone awareness for comparison
                    if reading_time.tzinfo is None:
                        reading_time = reading_time.replace(tzinfo=timezone.utc)
                    if anomaly_time.tzinfo is None:
                        anomaly_time = anomaly_time.replace(tzinfo=timezone.utc)
                        
                    # If anomaly is within 2 seconds of reading, it's related
                    time_diff = abs((reading_time - anomaly_time).total_seconds())
                    if time_diff < 5.0:  # 5 seconds tolerance
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
                    "timestamp": latest_reading.get('timestamp').isoformat() if latest_reading.get('timestamp') else datetime.now(timezone.utc).isoformat()
                }
                
                if latest_anomaly and is_related_anomaly:
                    response["severity"] = latest_anomaly.get("severity", "NORMAL")
                    response["anomaly_score"] = latest_anomaly.get("anomaly_score", 0)
                    response["action"] = latest_anomaly.get("action_taken", "None")
                else:
                    response["severity"] = "NORMAL"
                    response["anomaly_score"] = 0
                    response["action"] = "None"
                
                return response
        
        return self._in_memory_latest_status(device_id)

    def get_system_stats(self):
        """Get aggregated system statistics for admin dashboard"""
        if not self.use_db:
            return {
                "total_devices": 1,
                "active_devices": 1,
                "total_anomalies_24h": 0,
                "system_health": 100
            }

        # 1. Device Counts
        from app.database import get_collection
        devices_col = get_collection('devices')
        total_devices = devices_col.count_documents({})
        active_devices = devices_col.count_documents({"status": "active"})
        
        # 2. Anomalies in last 24h
        anomalies_col = self.anomalies
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        recent_anomalies = anomalies_col.count_documents({
            "timestamp": {"$gte": yesterday}
        })
        
        # 3. Calculate System Health (Simple heuristic)
        # 100 - (anomalies * 5) - (inactive_devices * 10), min 0
        inactive = total_devices - active_devices
        health_score = max(0, 100 - (recent_anomalies * 2) - (inactive * 5))
        
        return {
            "total_devices": total_devices,
            "active_devices": active_devices,
            "total_anomalies_24h": recent_anomalies,
            "system_health": health_score
        }

    def get_all_devices(self):
        """Get list of all devices with detailed status"""
        if not self.use_db:
            return []
            
        from app.database import get_collection
        devices_col = get_collection('devices')
        devices = list(devices_col.find({}, {"_id": 0}))
        
        # Enrich with last active time
        readings_col = self.sensor_readings
        anomalies_col = self.anomalies
        
        enriched_devices = []
        for d in devices:
            device_id = d.get("device_id")
            
            # Get last seen
            last_reading = readings_col.find_one(
                {"device_id": device_id},
                sort=[("timestamp", -1)]
            )
            
            # Get active alerts
            active_alert_count = anomalies_col.count_documents({
                "device_id": device_id,
                "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)},
                "severity": {"$ne": "NORMAL"}
            })
            
            d["last_active"] = last_reading["timestamp"].isoformat() if last_reading else None
            d["active_alerts"] = active_alert_count
            
            # Determine status based on last seen (e.g., offline if > 5 mins)
            is_online = False
            if last_reading:
                last_seen = last_reading["timestamp"]
                # Ensure timezone awareness
                if last_seen.tzinfo is None:
                    last_seen = last_seen.replace(tzinfo=timezone.utc)
                
                if (datetime.now(timezone.utc) - last_seen).total_seconds() < 300: # 5 mins
                    is_online = True
            
            d["status"] = "online" if is_online else "offline"
            
            enriched_devices.append(d)
            
        return enriched_devices
        
    def _in_memory_latest_status(self, device_id=None):
        # Fallback to in-memory cache
        target_id = device_id
        if not target_id:
            if self.latest_outputs:
                target_id = list(self.latest_outputs.keys())[-1]
            elif self.buffers:
                target_id = list(self.buffers.keys())[-1]
            else:
                return None
        
        if target_id not in self.buffers or not self.buffers[target_id]:
            return {"device_id": target_id, "status": "NO_DATA"}
        
        latest_data = self.buffers[target_id][-1]
        response = {
            "device_id": target_id,
            "data": latest_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if target_id in self.latest_outputs:
            analysis = self.latest_outputs[target_id]
            response["severity"] = analysis.get("severity", "NORMAL")
            response["anomaly_score"] = analysis.get("anomaly_score", 0)
            response["action"] = analysis.get("action", "None")
        
        return response
    
    def get_historical_data(self, device_id, time_range='1h'):
        """Get historical sensor data based on time range"""
        if not self.use_db:
            return []
        
        # Calculate time delta
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
        
        # Query MongoDB
        readings = list(self.sensor_readings.find(
            {
                "device_id": device_id,
                "timestamp": {"$gte": start_time}
            },
            sort=[("timestamp", 1)]
        ))
        
        # Convert ObjectId to string for JSON serialization
        for reading in readings:
            reading['_id'] = str(reading['_id'])
            if 'timestamp' in reading:
                reading['timestamp'] = reading['timestamp'].isoformat()
        
        return readings
    
    def get_notifications(self, device_id, severity='all', limit=50):
        """Get notification history"""
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
            if 'timestamp' in notif:
                notif['timestamp'] = notif['timestamp'].isoformat()
        
        return notifications
    
    def mark_notification_read(self, notification_id):
        """Mark notification as read"""
        if not self.use_db:
            return False
        
        from bson import ObjectId
        result = self.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}}
        )
        return result.modified_count > 0
    
    def get_anomaly_history(self, device_id, days=7):
        """Get anomaly history for reports"""
        if not self.use_db:
            return []
        
        start_time = datetime.now(timezone.utc) - timedelta(days=days)
        
        anomalies = list(self.anomalies.find(
            {
                "device_id": device_id,
                "timestamp": {"$gte": start_time}
            },
            sort=[("timestamp", -1)]
        ))
        
        for anomaly in anomalies:
            anomaly['_id'] = str(anomaly['_id'])
            if 'timestamp' in anomaly:
                anomaly['timestamp'] = anomaly['timestamp'].isoformat()
        
        return anomalies
    
    def get_device_health(self, device_id):
        """Get EnerQoT device health metrics"""
        if not self.use_db:
            return {"status": "unknown"}
        
        # Get recent readings count
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_count = self.sensor_readings.count_documents({
            "device_id": device_id,
            "timestamp": {"$gte": one_hour_ago}
        })
        
        # Get latest reading
        latest = self.sensor_readings.find_one(
            {"device_id": device_id},
            sort=[("timestamp", -1)]
        )
        
        if not latest:
            return {"status": "inactive", "message": "No data received"}
        
        # Calculate metrics
        time_since_last = datetime.now(timezone.utc) - latest['timestamp']
        data_quality = min(100, (recent_count / 60) * 100)  # Expect ~1 reading/min
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
