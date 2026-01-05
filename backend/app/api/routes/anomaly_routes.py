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
