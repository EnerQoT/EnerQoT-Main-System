
from app.services.firebase_service import firebase_service
from app.services.sensor_health_service import sensor_health_service

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

        # 3. Get Health Score from AI Model
        # The sensor_health_service expects the full raw structure to map fields correctly
        health_score, health_error = sensor_health_service.get_ai_score(raw_data)
        
        if health_error:
             # Decide if we want to fail the whole dashboard or just show "N/A" for health
             # For now, let's include the error but return the data
             health_data = {"score": None, "status": "Unknown", "color": "gray", "error": health_error}
        else:
             # Replicate the status logic or call a helper if it was shared.
             # Since the logic is inside the route in the previous step, I should propbably refactor or duplicate it.
             # Refactoring is better, but to keep it simple and encapsulated here:
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

        # 4. Construct Final Response
        return {
            "sensors": frontend_data,
            "health": health_data
        }, 200

dashboard_service = DashboardService()
