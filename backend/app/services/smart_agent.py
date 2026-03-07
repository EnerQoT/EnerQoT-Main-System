import numpy as np
import joblib
import pandas as pd
import os
from tensorflow.keras.models import load_model

from config.settings import RL_MODEL_PATH, RL_SCALER_PATH

class SmartAgent:
    def __init__(self):
        self.rl_model = None
        self.rl_scaler = None
        self._load_models()

    def _load_models(self):
        """Safely load RL artifacts if they exist"""
        try:
            if os.path.exists(RL_MODEL_PATH) and os.path.exists(RL_SCALER_PATH):
                print(f"[SMART AGENT] Loading RL Model from {RL_MODEL_PATH}...")
                self.rl_model = load_model(RL_MODEL_PATH)
                self.rl_scaler = joblib.load(RL_SCALER_PATH)
                print("[SMART AGENT] ✅ RL Model & Scaler loaded successfully.")
            else:
                print("[SMART AGENT] ⚠️  RL Artifacts not found. Running in Fallback Mode (Rules-only).")
        except Exception as e:
            print(f"[SMART AGENT] ❌ Error loading RL models: {e}")

    def act(self, device_id, severity, features=None):
        """
        Hybrid Decision Logic:
        Combines Unsupervised (Isolation Forest 'severity') + Supervised (RL 'action').
        
        RL Actions: 0=Normal, 1=Take Action (Anomaly)
        """
        rl_action = 0 # Default to Normal if model missing
        rl_confidence = 0.0
        
        # 1. Get RL Opinion if available
        if self.rl_model and self.rl_scaler and features is not None:
            try:
                # Scale features for RL (using its own scaler)
                # features shape is (1, 8)
                X_rl = self.rl_scaler.transform(features)
                
                # Predict
                q_values = self.rl_model.predict(X_rl, verbose=0)
                rl_action = np.argmax(q_values[0]) 
                # Confidence could be max Q-value or softmax (but Q-values aren't probs)
                # We'll validly just use the argmax action.
            except Exception as e:
                print(f"[SMART AGENT] Prediction Error: {e}")

        # 2. Hybrid Decision Matrix
        action_log = "No action needed."
        

        # CASE A: RL DETECTS ANOMALY (High Confidence Supervised)
        # We trust the RL agent most because it learned from labeled data/feedback.
        if rl_action == 1:
            log_msg = f"RL AGENT TRIGGER: Anomaly pattern detected (Severity: {severity})"
            return self._execute_critical(device_id, log_msg)

        if severity == "CRITICAL":
            # Action: Flag for Mobile Agent
            action_log = f"CRITICAL ANOMALY: Reporting to EnerQoT Autonomous Mobile Agent."
            # self._send_mqtt_command(device_id, "OFF") # Handled by mobile app natively now
            
        elif severity == "WARNING":
            # Action: Notify user
            action_log = f"WARNING: Abnormal power usage detected for Device {device_id}. Recommendation: Check appliance."
            self._send_notification(device_id, "Check Device")


        # CASE B: ISOLATION FOREST SAYS CRITICAL, BUT RL SAYS NORMAL
        # This implies a new/unknown anomaly that RL hasn't seen yet.
        # We downgrade to WARNING to avoid false positive shutdowns, but alert the user.
        if severity == "CRITICAL" and rl_action == 0:
            log_msg = f"HYBRID ALERT: Isolation Forest detected abnormality, but RL passed it. Flagging for review."
            return self._execute_warning(device_id, log_msg)

        # CASE C: STANDARD WARNING
        if severity == "WARNING":
            return self._execute_warning(device_id, "Minor deviation detected by Anomaly Model.")
            
        return action_log

    def _execute_critical(self, device_id, reason):
        print(f"[SMART AGENT] 🔴 CRITICAL ACTION: {reason}")
        self._send_mqtt_command(device_id, "OFF")
        return f"CRITICAL: {reason}. Device Shutdown Initiated."

    def _execute_warning(self, device_id, reason):
        print(f"[SMART AGENT] 🟡 WARNING ACTION: {reason}")
        self._send_notification(device_id, reason)
        return f"WARNING: {reason}"

    def _send_mqtt_command(self, device_id, command):
        print(f"[SMART AGENT] >> MQTT PUB: topic=devices/{device_id}/control, payload={command}")

    def _send_notification(self, device_id, message):
        print(f"[SMART AGENT] >> NOTIFICATION: Device {device_id}: {message}")

    def train_online(self, features, correct_label):
        """
        Online learning adjustment based on user feedback.
        correct_label: 0 (Normal) or 1 (Anomaly)
        
        This mimics the original HybridAnomalyModel.train_online logic but
        adapted for SmartAgent which now holds the model.
        """
        if not self.rl_model or not self.rl_scaler:
            print("[SMART AGENT] ❌ Cannot train: RL Model/Scaler not loaded.")
            return

        try:
            # 1. Prepare State
            state = self.rl_scaler.transform(features)
            
            # 2. Assign Reward (Simple Policy)
            # If user corrected us, we want to maximize the probability of the CORRECT label.
            # Reward = +10 for finding the correct state-action pair.
            action = correct_label
            reward = 10.0
            next_state = state # Simplification for single-step feedback
            done = False
            
            # 3. Predict Q-values for current state (Target Construction)
            # We want Q(state, correct_action) to approach Reward + gamma * max Q(next_state)
            target = self.rl_model.predict(state, verbose=0)
            
            # Since this is a single step correction, we simplify Q-learning update:
            # target[0][action] = reward 
            # (Assuming gamma=0 or immediate terminal state for this feedback loop)
            target[0][action] = reward
            
            # 4. Fit the model (Single gradient descent step)
            self.rl_model.fit(state, target, epochs=1, verbose=0)
            
            print(f"[SMART AGENT] 🎓 Aprendizaje realizado: Label={correct_label}. Weights updated.")
            
            # Optional: Save updated model (Disabled to prevent corruption during dev)
            # self.rl_model.save(RL_MODEL_PATH)
            
        except Exception as e:
            print(f"[SMART AGENT] ❌ Error in online training: {e}")
