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
