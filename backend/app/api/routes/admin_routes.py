from flask import Blueprint, jsonify
from app.services.anomaly_service import AnomalyService

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")
service = AnomalyService()

@admin_bp.route("/dashboard", methods=["GET"])
def get_dashboard():
    """Get high-level dashboard statistics"""
    stats = service.get_system_stats()
    return jsonify(stats)

@admin_bp.route("/devices", methods=["GET"])
def get_devices():
    """Get list of all devices"""
    devices = service.get_all_devices()
    return jsonify({"devices": devices})
