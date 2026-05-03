from flask import Blueprint, jsonify, request
from app.services.tips_service import TipsService

api = Blueprint('tips', __name__)

# Helper to get service (could be instantiated per request or globally)
@api.route("/telemetry", methods=["POST"])
def post_telemetry():
    """
    Receives current usage data from a specific device and returns 
    an immediate recommendation.
    Expected JSON: {"device": "AC", "usage": 4.5}
    """
    data = request.get_json()
    
    if not data or 'device' not in data or 'usage' not in data:
        return jsonify({"error": "Missing device or usage data"}), 400
    
    device = data['device']
    current_usage = data['usage']
    
    service = get_service()
    # Process the real-time data point
    analysis = service.analyze_current_usage(device, current_usage)
    
    return jsonify({
        "status": "success",
        "analysis": analysis
    }), 201

@api.route("/settings/thresholds", methods=["POST"])
def update_thresholds():
    """
    Allows updating the standard deviation sensitivity for recommendations.
    Expected JSON: {"std_multiplier": 1.5}
    """
    data = request.get_json()
    multiplier = data.get('std_multiplier')
    
    if multiplier:
        service = get_service()
        service.update_config('std_multiplier', multiplier)
        return jsonify({"message": "Thresholds updated"}), 200
    
    return jsonify({"error": "Invalid data"}), 400

def get_service():
    return TipsService.get_instance()

@api.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "OK", "message": "Energy API running"})

@api.route("/forecast", methods=["GET"])
def forecast():
    service = get_service()
    return jsonify(service.get_forecast())

@api.route("/top-devices", methods=["GET"])
def top_devices():
    service = get_service()
    return jsonify(service.get_top_devices())

# Global instance to avoid reloading models on every request
_shared_anomaly_service = None

def get_anomaly_service():
    global _shared_anomaly_service
    if _shared_anomaly_service is None:
        from app.services.anomaly_service import AnomalyService
        _shared_anomaly_service = AnomalyService()
    return _shared_anomaly_service

@api.route("/realtime", methods=["GET"])
def realtime_data():
    service = get_anomaly_service()
    status = service.get_latest_status('test_device_01')
    if not status or 'data' not in status:
        return jsonify({"error": "No data available in system"}), 404
    return jsonify(status['data']), 200

@api.route("/recommendations", methods=["GET"])
def recommendations():
    service = get_service()
    top = service.get_top_devices()
    recs = service.generate_recommendations(top)
    return jsonify(recs)

@api.route("/all", methods=["GET"])
def all_data():
    service = get_service()
    forecast_data = service.get_forecast()
    top_devices = service.get_top_devices()
    recs = service.generate_recommendations(top_devices)

    return jsonify({
        "forecast": forecast_data,
        "top_devices": top_devices,
        "recommendations": recs
    })
