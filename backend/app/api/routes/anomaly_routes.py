from flask import Blueprint, request, jsonify
from app.services.anomaly_service import AnomalyService
from datetime import datetime, timezone

anomaly_bp = Blueprint("anomaly", __name__)
service = AnomalyService()


# ------------------------------------------------------------------
# Sensor Data Ingestion
# ------------------------------------------------------------------
@anomaly_bp.route("/sensor-data", methods=["POST"])
def sensor_data():
    """Receive sensor reading and run full hybrid anomaly detection pipeline."""
    data = request.json

    required = ["device_id", "voltage", "current", "frequency", "power_factor", "temperature"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields", "required": required}), 400

    payload = {
        "voltage": float(data["voltage"]),
        "current": float(data["current"]),
        "frequency": float(data["frequency"]),
        "power_factor": float(data["power_factor"]),
        "temperature": float(data["temperature"]),
        "relay_status": data.get("relay_status", "ON")
    }

    result = service.process(data["device_id"], payload)
    return jsonify(result)


# ------------------------------------------------------------------
# Feedback Endpoints
# ------------------------------------------------------------------
@anomaly_bp.route("/feedback", methods=["POST"])
def feedback():
    """
    Legacy feedback endpoint — accepts correct_label (0 or 1).
    Also accepts optional feedback_type for clarity.
    """
    data = request.json

    if "device_id" not in data or "correct_label" not in data:
        return jsonify({"error": "Missing device_id or correct_label"}), 400

    label = int(data["correct_label"])
    feedback_type = data.get("feedback_type")
    notification_id = data.get("notification_id")

    result = service.handle_feedback(
        device_id=data["device_id"],
        correct_label=label,
        feedback_type=feedback_type,
        notification_id=notification_id
    )
    return jsonify(result)


@anomaly_bp.route("/feedback/notification", methods=["POST"])
def feedback_notification():
    """
    Dedicated feedback endpoint triggered from mobile app notification cards.

    Body: {
        "notification_id": "<mongo_id>",
        "device_id":       "test_device_01",
        "feedback_type":   "confirm" | "false_alarm",
        "correct_severity": "NORMAL" | "WARNING" | "CRITICAL"   (required when feedback_type=false_alarm)
    }

    When feedback_type=confirm:
      - DQN receives strong positive reward for anomaly action

    When feedback_type=false_alarm:
      - correct_severity tells the DQN what the RIGHT severity should have been
      - Reward magnitude is graduated based on the severity mismatch gap
    """
    data = request.json

    if not data:
        return jsonify({"error": "Request body required"}), 400

    required = ["notification_id", "device_id", "feedback_type"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    feedback_type = data["feedback_type"]
    if feedback_type not in ("confirm", "false_alarm"):
        return jsonify({"error": "feedback_type must be 'confirm' or 'false_alarm'"}), 400

    # correct_severity: required for false_alarm, optional for confirm
    correct_severity = data.get("correct_severity")
    valid_severities = ("NORMAL", "WARNING", "CRITICAL")
    if correct_severity:
        correct_severity = correct_severity.upper()
        if correct_severity not in valid_severities:
            return jsonify({"error": f"correct_severity must be one of {valid_severities}"}), 400

    if feedback_type == "false_alarm" and not correct_severity:
        return jsonify({
            "error": "correct_severity is required when feedback_type is 'false_alarm'. "
                     "Specify what the severity SHOULD have been: NORMAL, WARNING, or CRITICAL"
        }), 400

    device_id = data["device_id"]
    notification_id = data["notification_id"]

    # Derive correct_label from correct_severity (for confirm, default to anomaly=1)
    if correct_severity:
        correct_label = 0 if correct_severity == "NORMAL" else 1
    else:
        correct_label = 1 if feedback_type == "confirm" else 0

    # Trigger online learning with severity-aware reward
    result = service.handle_feedback(
        device_id=device_id,
        correct_label=correct_label,
        feedback_type=feedback_type,
        notification_id=notification_id,
        correct_severity=correct_severity
    )

    # Update the notification document with feedback
    if service.use_db:
        try:
            from bson import ObjectId
            service.notifications.update_one(
                {"_id": ObjectId(notification_id)},
                {"$set": {
                    "feedback_type": feedback_type,
                    "correct_severity": correct_severity,
                    "feedback_submitted_at": datetime.now(timezone.utc),
                    "read": True
                }}
            )
        except Exception as e:
            print(f"Warning: Could not update notification feedback status: {e}")

    return jsonify({
        **result,
        "notification_id": notification_id,
        "feedback_type": feedback_type,
        "correct_severity": correct_severity
    })


# ------------------------------------------------------------------
# Status & Real-Time Endpoints
# ------------------------------------------------------------------
@anomaly_bp.route("/status", methods=["GET"])
def status():
    """Get latest anomaly status for a device. ?device_id=xyz"""
    device_id = request.args.get("device_id")
    result = service.get_latest_status(device_id)
    if not result:
        return jsonify({"status": "no_data"}), 200
    return jsonify(result)


@anomaly_bp.route("/device/control", methods=["POST"])
def device_control():
    """Simulate sending an MQTT command to a physical device."""
    data = request.json

    if not data or "device_id" not in data or "command" not in data:
        return jsonify({"error": "Missing device_id or command"}), 400

    device_id = data["device_id"]
    command = data["command"]

    if command not in ["ON", "OFF"]:
        return jsonify({"error": "Invalid command. Must be 'ON' or 'OFF'"}), 400

    service.agent._send_mqtt_command(device_id, command)

    return jsonify({
        "status": "success",
        "message": f"Command {command} sent to device {device_id}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# ------------------------------------------------------------------
# Historical Data Endpoints
# ------------------------------------------------------------------
@anomaly_bp.route("/history/<device_id>", methods=["GET"])
def get_history(device_id):
    """Get historical sensor data for charts."""
    time_range = request.args.get('range', '1h')
    data = service.get_historical_data(device_id, time_range)
    return jsonify({"device_id": device_id, "range": time_range, "data": data})


@anomaly_bp.route("/notifications/<device_id>", methods=["GET"])
def get_notifications(device_id):
    """Get notification history with feedback status."""
    severity = request.args.get('severity', 'all')
    limit = int(request.args.get('limit', 50))
    notifications = service.get_notifications(device_id, severity, limit)
    return jsonify({"device_id": device_id, "notifications": notifications})


@anomaly_bp.route("/notifications/<notification_id>/read", methods=["PUT"])
def mark_notification_read(notification_id):
    """Mark notification as read."""
    success = service.mark_notification_read(notification_id)
    return jsonify({"success": success})


@anomaly_bp.route("/anomalies/<device_id>", methods=["GET"])
def get_anomalies(device_id):
    """Get anomaly history for reports."""
    days = int(request.args.get('days', 7))
    anomalies = service.get_anomaly_history(device_id, days)
    return jsonify({"device_id": device_id, "anomalies": anomalies})


@anomaly_bp.route("/device-health/<device_id>", methods=["GET"])
def get_device_health(device_id):
    """Get EnerQoT device health metrics."""
    health = service.get_device_health(device_id)
    return jsonify({"device_id": device_id, "health": health})


@anomaly_bp.route("/agent-stats", methods=["GET"])
def get_agent_stats():
    """Get DQN agent training statistics (feedback count, accuracy, replay buffer size)."""
    stats = service.agent.get_training_stats()
    return jsonify({"stats": stats})


@anomaly_bp.route("/tips", methods=["GET"])
def get_tips():
    """Get energy-saving tips from database."""
    from app.database import get_collection
    tips_collection = get_collection('tips')

    if tips_collection:
        tips = list(tips_collection.find({}, {"_id": 0}).sort("priority", -1).limit(10))
        return jsonify({"tips": tips})
    else:
        return jsonify({"tips": []})


@anomaly_bp.route("/reports/<device_id>", methods=["GET"])
def get_reports(device_id):
    """Get reports data with statistics."""
    period = request.args.get('period', 'daily')

    days_map = {'daily': 1, 'weekly': 7, 'monthly': 30}
    days = days_map.get(period, 7)

    anomalies = service.get_anomaly_history(device_id, days)

    total_anomalies = len(anomalies)
    critical_count = sum(1 for a in anomalies if a.get('severity') == 'CRITICAL')
    warning_count = sum(1 for a in anomalies if a.get('severity') == 'WARNING')

    time_range = '1d' if period == 'daily' else 'week' if period == 'weekly' else 'month'
    historical_data = service.get_historical_data(device_id, time_range)

    total_energy = sum(
        r.get('voltage', 0) * r.get('current', 0) * r.get('power_factor', 0) / 1000
        for r in historical_data
    )

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
