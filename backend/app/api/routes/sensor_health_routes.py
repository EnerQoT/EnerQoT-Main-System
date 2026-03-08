
from flask import Blueprint, request, jsonify
from app.services.sensor_health_service import sensor_health_service

sensor_health_bp = Blueprint('sensor_health', __name__)

@sensor_health_bp.route('/health', methods=['POST'])
def check_health():
    data = request.json
    
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    # 1. Get AI Score
    score, error = sensor_health_service.get_ai_score(data)
    if error:
        return jsonify({"error": error}), 400

    # 2. Interpret the Score (The "Safety Logic")
    status = "Healthy"
    color = "green"
    
    # Logic from user requirement
    if score < 40:
        status = "CRITICAL WARNING"
        color = "red"
        # Since we know the score is low, let's find out WHY (Simple Rule Check)
        try:
             if data['system']['cpu_temp'] > 80: status += " (Overheating)"
             elif data['system']['rssi'] < -90: status += " (Connection Lost)"
             elif data['ina3221']['battery']['voltage'] < 3.5: status += " (Dead Battery)"
             else: status += " (Anomaly Detected)"
        except KeyError:
             status += " (Anomaly Detected - Incomplete Data)"
        
    elif score < 50:
        status = "Warning: System Unstable"
        color = "orange"

    # 3. Return Response
    response = {
        "health_score": score,
        "status_text": status,
        "status_color": color,
        "raw_data": data
    }
    return jsonify(response)
