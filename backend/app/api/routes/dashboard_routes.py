
from flask import Blueprint, jsonify
from app.services.dashboard_service import dashboard_service

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard/data', methods=['GET'])
def get_dashboard_data():
    """
    Get consolidated real-time data and health status for the dashboard.
    """
    data, status_code = dashboard_service.get_dashboard_data()
    return jsonify(data), status_code
