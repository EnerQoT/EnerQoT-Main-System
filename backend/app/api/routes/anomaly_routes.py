from flask import Blueprint, request, jsonify
from app.services.anomaly_service import AnomalyService

anomaly_bp = Blueprint("anomaly", __name__)
service = AnomalyService()

@anomaly_bp.route("/sensor-data", methods=["POST"])
def sensor_data():
    data = request.json

    required = ["device_id", "voltage", "current", "frequency", "power_factor", "temperature"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    payload = {
        "voltage": float(data["voltage"]),
        "current": float(data["current"]),
        "frequency": float(data["frequency"]),
        "power_factor": float(data["power_factor"]),
        "temperature": float(data["temperature"])
    }

    result = service.process(data["device_id"], payload)
    return jsonify(result)

@anomaly_bp.route("/feedback", methods=["POST"])
def feedback():
    data = request.json
    
    if "device_id" not in data or "correct_label" not in data:
        return jsonify({"error": "Missing device_id or correct_label"}), 400
        
    result = service.handle_feedback(data["device_id"], int(data["correct_label"]))
    return jsonify(result)

@anomaly_bp.route("/status", methods=["GET"])
def status():
    # Optional: ?device_id=xyz
    device_id = request.args.get("device_id")
    result = service.get_latest_status(device_id)
    if not result:
        return jsonify({"status": "no_data"}), 200
    return jsonify(result)

# New endpoints for real data integration

@anomaly_bp.route("/history/<device_id>", methods=["GET"])
def get_history(device_id):
    """Get historical sensor data for charts"""
    time_range = request.args.get('range', '1h')
    data = service.get_historical_data(device_id, time_range)
    return jsonify({"device_id": device_id, "range": time_range, "data": data})

@anomaly_bp.route("/notifications/<device_id>", methods=["GET"])
def get_notifications(device_id):
    """Get notification history"""
    severity = request.args.get('severity', 'all')
    limit = int(request.args.get('limit', 50))
    notifications = service.get_notifications(device_id, severity, limit)
    return jsonify({"device_id": device_id, "notifications": notifications})

@anomaly_bp.route("/notifications/<notification_id>/read", methods=["PUT"])
def mark_notification_read(notification_id):
    """Mark notification as read"""
    success = service.mark_notification_read(notification_id)
    return jsonify({"success": success})

@anomaly_bp.route("/anomalies/<device_id>", methods=["GET"])
def get_anomalies(device_id):
    """Get anomaly history for reports"""
    days = int(request.args.get('days', 7))
    anomalies = service.get_anomaly_history(device_id, days)
    return jsonify({"device_id": device_id, "anomalies": anomalies})

@anomaly_bp.route("/device-health/<device_id>", methods=["GET"])
def get_device_health(device_id):
    """Get EnerQoT device health metrics"""
    health = service.get_device_health(device_id)
    return jsonify({"device_id": device_id, "health": health})

@anomaly_bp.route("/tips", methods=["GET"])
def get_tips():
    """Get energy-saving tips from database"""
    # This will be populated from seed data
    from app.database import get_collection
    tips_collection = get_collection('tips')
    
    if tips_collection:
        tips = list(tips_collection.find({}, {"_id": 0}).sort("priority", -1).limit(10))
        return jsonify({"tips": tips})
    else:
        # Fallback hardcoded tips if no database
        return jsonify({"tips": []})

@anomaly_bp.route("/reports/<device_id>", methods=["GET"])
def get_reports(device_id):
    """Get reports data with statistics"""
    period = request.args.get('period', 'daily')
    
    # Get anomaly history
    days_map = {'daily': 1, 'weekly': 7, 'monthly': 30}
    days = days_map.get(period, 7)
    
    anomalies = service.get_anomaly_history(device_id, days)
    
    # Calculate statistics
    total_anomalies = len(anomalies)
    critical_count = sum(1 for a in anomalies if a.get('severity') == 'CRITICAL')
    warning_count = sum(1 for a in anomalies if a.get('severity') == 'WARNING')
    
    # Get historical data for energy consumption
    time_range = '1d' if period == 'daily' else 'week' if period == 'weekly' else 'month'
    historical_data = service.get_historical_data(device_id, time_range)
    
    # Calculate total energy (simplified)
    total_energy = 0
    for reading in historical_data:
        power = reading.get('voltage', 0) * reading.get('current', 0) * reading.get('power_factor', 0)
        total_energy += power / 1000  # Convert to kWh approximation
    
    return jsonify({
        "device_id": device_id,
        "period": period,
        "statistics": {
            "total_anomalies": total_anomalies,
            "critical_count": critical_count,
            "warning_count": warning_count,
            "total_energy_kwh": round(total_energy, 2)
        },
        "anomalies": anomalies,
        "energy_data": historical_data
    })
