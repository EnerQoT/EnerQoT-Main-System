
class SmartAgent:
    def __init__(self):
        pass

    def act(self, device_id, severity, anomaly_details=None):
        """
        Decides and executes an action based on severity.
        Returns a description of the action taken.
        """
        action_log = "No action needed."
        
        if severity == "CRITICAL":
            # Action: Turn off device (Simulated)
            action_log = f"CRITICAL ANOMALY: Initiating Emergency Shutdown for Device {device_id} via Smart Plug."
            self._send_mqtt_command(device_id, "OFF")
            
        elif severity == "WARNING":
            # Action: Notify user
            action_log = f"WARNING: Abnormal power usage detected for Device {device_id}. Recommendation: Check appliance."
            self._send_notification(device_id, "Check Device")

        return action_log

    def _send_mqtt_command(self, device_id, command):
        # Simulation
        print(f"[SMART AGENT] >> MQTT PUB: topic=devices/{device_id}/control, payload={command}")

    def _send_notification(self, device_id, message):
        # Simulation
        print(f"[SMART AGENT] >> NOTIFICATION: Device {device_id}: {message}")
