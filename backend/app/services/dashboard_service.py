
from datetime import datetime, timezone
from app.services.firebase_service import firebase_service
from app.services.sensor_health_service import sensor_health_service

# How many seconds of silence before we consider the device offline
OFFLINE_THRESHOLD_SECONDS = 30

class DashboardService:
    def get_dashboard_data(self):
        # 1. Fetch latest data from Firebase
        raw_data = firebase_service.get_latest_sensor_data()
        if not raw_data:
             return {"error": "No data available in Firebase"}, 404

        # 2. Extract specific fields for Frontend
        try:
            frontend_data = {
                "battery_voltage": raw_data.get('ina3221', {}).get('battery', {}).get('voltage'),
                "battery_current": raw_data.get('ina3221', {}).get('battery', {}).get('current_ma'),
                "esp32_voltage": raw_data.get('ina3221', {}).get('esp', {}).get('voltage'),
                "esp32_current": raw_data.get('ina3221', {}).get('esp', {}).get('current_ma'),
                "main_voltage": raw_data.get('ina3221', {}).get('main', {}).get('voltage'),
                "main_current": raw_data.get('ina3221', {}).get('main', {}).get('current_ma'),
                "humidity": raw_data.get('si7021', {}).get('humidity'),
                "ambient_temp": raw_data.get('si7021', {}).get('temperature'),
                "cpu_temp": raw_data.get('system', {}).get('cpu_temp'),
                # Convert bytes to Kb: 194056 -> ~189.5 Kb
                "free_heap_kb": round(raw_data.get('system', {}).get('free_heap', 0) / 1024, 2),
                "rssi": raw_data.get('system', {}).get('rssi'),
                "timestamp": raw_data.get('timestamp')
            }
        except Exception as e:
            return {"error": f"Error parsing data fields: {str(e)}"}, 500

        # 3. Determine device online/offline status from timestamp
        device_online = True
        data_age_seconds = None
        raw_ts = raw_data.get('timestamp')
        if raw_ts:
            try:
                # Support both ISO-format strings and epoch numbers
                if isinstance(raw_ts, (int, float)):
                    data_time = datetime.fromtimestamp(raw_ts, tz=timezone.utc)
                else:
                    # Try parsing ISO format (e.g. "2026-05-03T16:30:00Z")
                    ts_str = str(raw_ts).replace('Z', '+00:00')
                    data_time = datetime.fromisoformat(ts_str)
                    if data_time.tzinfo is None:
                        data_time = data_time.replace(tzinfo=timezone.utc)

                now = datetime.now(timezone.utc)
                data_age_seconds = round((now - data_time).total_seconds(), 1)
                device_online = data_age_seconds < OFFLINE_THRESHOLD_SECONDS
            except Exception as e:
                print(f"Warning: Could not parse timestamp '{raw_ts}': {e}")

        # 4. Get Health Score from AI Model
        # The sensor_health_service expects the full raw structure to map fields correctly
        health_score, is_anomaly, health_error = sensor_health_service.get_ai_score(raw_data)
        
        if health_error:
             # Decide if we want to fail the whole dashboard or just show "N/A" for health
             # For now, let's include the error but return the data
             health_data = {"score": None, "status": "Unknown", "color": "gray", "error": health_error}
        else:
             status = "Healthy"
             color = "green"
             
             if health_score < 45:
                status = "CRITICAL WARNING"
                color = "red"
                try:
                     if frontend_data['cpu_temp'] > 80: status += " (Overheating)"
                     elif frontend_data['rssi'] < -90: status += " (Connection Lost)"
                     elif frontend_data['battery_voltage'] < 3.5: status += " (Dead Battery)"
                     else: status += " (Anomaly Detected)"
                except:
                     pass
             elif health_score < 50:
                status = "Warning: System Unstable"
                color = "orange"
             
             health_data = {
                 "score": health_score,
                 "status": status,
                 "color": color
             }

        # 5. Construct Final Response
        return {
            "sensors": frontend_data,
            "health": health_data,
            "device_online": device_online,
            "data_age_seconds": data_age_seconds
        }, 200

dashboard_service = DashboardService()
