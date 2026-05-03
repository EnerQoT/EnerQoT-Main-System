import numpy as np
import joblib
import os
from collections import deque
import random
from tensorflow.keras.models import load_model

from config.settings import RL_MODEL_PATH, RL_SCALER_PATH

# DQN Replay buffer hyperparameters
REPLAY_BATCH_SIZE = 32
REPLAY_MEMORY_SIZE = 2000
GAMMA = 0.95     # Discount factor


class SmartAgent:
    def __init__(self):
        self.rl_model = None
        self.rl_scaler = None

        # Experience replay buffer for online DQN learning
        self.replay_memory = deque(maxlen=REPLAY_MEMORY_SIZE)

        # Training stats
        self.feedback_count = 0
        self.correct_predictions = 0

        self._load_models()

    # ------------------------------------------------------------------
    # Model Loading
    # ------------------------------------------------------------------
    def _load_models(self):
        """Safely load RL artifacts if they exist."""
        try:
            if os.path.exists(RL_MODEL_PATH) and os.path.exists(RL_SCALER_PATH):
                print(f"[SMART AGENT] Loading RL Model from {RL_MODEL_PATH}...")
                self.rl_model = load_model(RL_MODEL_PATH)
                self.rl_scaler = joblib.load(RL_SCALER_PATH)
                rl_features = self.rl_scaler.n_features_in_
                rl_input    = self.rl_model.input_shape[-1]
                print(f"[SMART AGENT] [OK] RL Model loaded. Expects {rl_input} input features.")
                print(f"[SMART AGENT] [OK] RL Scaler loaded. Trained on {rl_features} features.")
                # Store expected feature count for runtime validation
                self.rl_n_features = rl_features
            else:
                print("[SMART AGENT] [WARN] RL Artifacts not found. Running in Fallback Mode (iForest-only).")
        except Exception as e:
            print(f"[SMART AGENT] [ERROR] Error loading RL models: {e}")

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------
    def get_dqn_output(self, raw_features):
        """
        Runs the DQN on raw sensor features and returns (action, q_values).

        The RL model was trained on 5 RAW sensor features:
          [voltage, current, frequency, power_factor, temperature]
        This is SEPARATE from the 8 engineered features used by iForest.

        Args:
            raw_features: numpy array shape (1, 5) — raw sensor readings

        Returns:
            (action: int, q_values: np.array shape (2,)) or (0, None) on failure
        """
        if self.rl_model is None or self.rl_scaler is None or raw_features is None:
            return 0, None

        try:
            # Ensure input shape matches what RL scaler expects
            expected = getattr(self, 'rl_n_features', 5)
            if raw_features.shape[1] != expected:
                print(f"[SMART AGENT] [WARN] Feature mismatch: got {raw_features.shape[1]}, expected {expected}")
                return 0, None

            X_rl = self.rl_scaler.transform(raw_features)           # (1, 5)
            q_values = self.rl_model.predict(X_rl, verbose=0)[0]    # shape (2,)
            action = int(np.argmax(q_values))
            return action, q_values
        except Exception as e:
            print(f"[SMART AGENT] DQN Prediction Error: {e}")
            return 0, None

    def act(self, device_id, severity, raw_features=None):
        """
        Hybrid Decision Logic:
          - Gets DQN action from trained RL model using RAW sensor features (5-dim)
          - Combines with unsupervised iForest severity for final decision.
        Returns action string for logging/notifications.
        """
        rl_action, q_values = self.get_dqn_output(raw_features)
        rl_label = "ANOMALY" if rl_action == 1 else "NORMAL"
        print(f"[SMART AGENT] DQN Decision: {rl_label} | iForest Severity: {severity}")

        # CASE A: DQN detects Anomaly (trusted supervised signal)
        if rl_action == 1:
            log_msg = f"RL AGENT TRIGGER: Anomaly pattern detected (iForest Severity: {severity})"
            
            # Check if smart agent is enabled for this device
            is_enabled = self._is_agent_enabled(device_id)
            if is_enabled:
                return self._execute_critical(device_id, log_msg)
            else:
                print(f"[SMART AGENT] Anomaly detected but Smart Agent is DISABLED for {device_id}. Skipping shutdown.")
                return f"CRITICAL: {log_msg}. (Auto-shutdown disabled)"

        # CASE B: iForest says CRITICAL but DQN says Normal
        # → Could be a new unseen pattern. Downgrade to WARNING for safety.
        if severity == "CRITICAL" and rl_action == 0:
            log_msg = "HYBRID ALERT: iForest detected abnormality, RL Agent disagrees. Flagging for review."
            return self._execute_warning(device_id, log_msg)

        # CASE C: iForest WARNING, DQN Normal → minor deviation
        if severity == "WARNING":
            return self._execute_warning(device_id, "Minor deviation detected by Anomaly Model.")

        return "No action needed."

    def _is_agent_enabled(self, device_id):
        """Check MongoDB to see if the smart agent is toggled ON for this device."""
        from app.database import get_collection
        devices = get_collection('devices')
        if devices:
            try:
                device = devices.find_one({"device_id": device_id})
                if device:
                    return device.get("smart_agent_enabled", True)
            except Exception as e:
                print(f"[SMART AGENT] Error checking agent status: {e}")
        return True  # Default to True if we can't check

    # ------------------------------------------------------------------
    # Action Executors
    # ------------------------------------------------------------------
    def _execute_critical(self, device_id, reason):
        print(f"[SMART AGENT] [CRIT] CRITICAL ACTION: {reason}")
        self._send_mqtt_command(device_id, "OFF")
        return f"CRITICAL: {reason}. Device Shutdown Initiated."

    def _execute_warning(self, device_id, reason):
        print(f"[SMART AGENT] [WARN] WARNING ACTION: {reason}")
        self._send_notification(device_id, reason)
        return f"WARNING: {reason}"

    def _send_mqtt_command(self, device_id, command):
        """Send ON/OFF command to the physical relay device via HTTP (non-blocking)."""
        import threading, urllib.request, urllib.error, json as _json

        base_url = os.getenv("RELAY_API_URL", "http://13.63.174.202:8000").rstrip("/")
        RELAY_URL = f"{base_url}/relay"
        api_key = os.getenv("RELAY_API_KEY", "rqYXdhShTLvjp6DCKSEEVTlw588pZQ9OKr7T5")

        def _fire():
            payload = _json.dumps({"command": command}).encode("utf-8")
            req = urllib.request.Request(
                RELAY_URL,
                data=payload,
                headers={"Content-Type": "application/json", "X-API-Key": api_key},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    body = resp.read().decode("utf-8", errors="replace")
                    print(f"[RELAY] [OK] Command={command} device={device_id} -> HTTP {resp.status}: {body}")
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", errors="replace")
                print(f"[RELAY] [ERROR] HTTPError {e.code} for command={command}: {body}")
            except Exception as e:
                print(f"[RELAY] [ERROR] Failed to reach relay for command={command}: {e}")

        print(f"[RELAY] [SYNC] Sending command={command} to device={device_id} -> {RELAY_URL}")
        t = threading.Thread(target=_fire, daemon=True)
        t.start()


    def _send_notification(self, device_id, message):
        print(f"[SMART AGENT] >> NOTIFICATION: Device {device_id}: {message}")

    # ------------------------------------------------------------------
    # Online Learning from User Feedback
    # ------------------------------------------------------------------
    def train_online(self, raw_features, correct_label, feedback_type="unknown",
                     correct_severity=None):
        """
        Performs one online DQN learning step based on user feedback.

        Graduated severity-aware rewards:
          Model said NORMAL, user says it should be CRITICAL  → strongest penalty (-15)
          Model said NORMAL, user says it should be WARNING   → strong penalty (-10)
          Model said CRITICAL, user says it should be NORMAL  → correction (+10/-10)
          Model said WARNING,  user says it should be CRITICAL → gentle push (+5/-5)
          Simple confirm                                       → standard (+10/-10)

        Args:
            raw_features:     numpy array shape (1, 5) — raw sensor readings for RL
            correct_label:    int  — 0=Normal, 1=Anomaly (WARNING or CRITICAL)
            feedback_type:    str  — "confirm" | "false_alarm"
            correct_severity: str  — "NORMAL" | "WARNING" | "CRITICAL" (user's correction)

        Returns:
            dict with training result information
        """
        if self.rl_model is None or self.rl_scaler is None:
            print("[SMART AGENT] Cannot train: RL Model/Scaler not loaded.")
            return {"success": False, "reason": "RL model not loaded"}

        try:
            # 1. Prepare scaled state using raw (5-feature) input
            expected = getattr(self, 'rl_n_features', 5)
            if raw_features is None or raw_features.shape[1] != expected:
                return {"success": False, "reason": f"Expected (1,{expected}) features for RL training"}
            state = self.rl_scaler.transform(raw_features)  # shape (1, 5)

            # 2. Get current DQN prediction BEFORE update
            current_q = self.rl_model.predict(state, verbose=0)[0]
            predicted_action = int(np.argmax(current_q))
            was_correct = (predicted_action == correct_label)

            self.feedback_count += 1
            if was_correct:
                self.correct_predictions += 1

            # 3. Graduated Severity-Aware Reward Shaping
            #
            # Severity ladder: NORMAL(0) < WARNING(1) < CRITICAL(2)
            # The larger the mismatch between predicted and correct severity,
            # the stronger the reward signal.
            #
            # correct_severity provided  → compute gap-based rewards
            # correct_severity missing   → fall back to binary rewards

            SEV_RANK = {"NORMAL": 0, "WARNING": 1, "CRITICAL": 2}

            if correct_severity and correct_severity.upper() in SEV_RANK:
                target_sev = correct_severity.upper()
                target_rank = SEV_RANK[target_sev]
                # Predict the model's current perceived severity from its Q-values
                # action=0 → NORMAL, action=1 → WARNING (conservative) or CRITICAL
                predicted_sev_rank = 0 if predicted_action == 0 else 1  # simplified

                sev_gap = abs(target_rank - predicted_sev_rank)  # 0, 1, or 2

                # Scale rewards by gap: gap=2 (NORMAL<->CRITICAL) is most critical
                if target_rank == 0:          # Correct = NORMAL
                    reward_for_correct = 8.0  # reward action=0
                    reward_for_wrong   = -8.0 - (sev_gap * 3)  # -8 to -14
                elif target_rank == 2:        # Correct = CRITICAL — most dangerous miss
                    reward_for_correct = 10.0 + (sev_gap * 5)  # +10 to +20
                    reward_for_wrong   = -10.0 - (sev_gap * 5) # -10 to -20
                else:                         # Correct = WARNING
                    reward_for_correct = 8.0
                    reward_for_wrong   = -8.0

                print(
                    f"[SMART AGENT] Severity correction: {correct_severity} "
                    f"(gap={sev_gap}) | "
                    f"reward_correct={reward_for_correct:.1f}, "
                    f"reward_wrong={reward_for_wrong:.1f}"
                )
            else:
                # Binary fallback (no severity info provided)
                if correct_label == 1:        # Anomaly confirmed
                    reward_for_correct = 10.0
                    reward_for_wrong   = -10.0
                else:                         # False alarm — it's NORMAL
                    reward_for_correct = 5.0
                    reward_for_wrong   = -10.0

            # 4. Build target Q-values
            target_q = current_q.copy()
            wrong_label = 1 - correct_label
            target_q[correct_label] = reward_for_correct
            target_q[wrong_label]   = reward_for_wrong

            # 5. Store experience in replay buffer
            self.replay_memory.append((state, correct_label, reward_for_correct, state, True))

            # 6. Immediate gradient step
            self.rl_model.fit(state, target_q.reshape(1, -1), epochs=1, verbose=0)

            # 7. Batch replay when buffer is full
            replay_success = False
            if len(self.replay_memory) >= REPLAY_BATCH_SIZE:
                replay_success = self._replay()

            # 8. Save to disk
            self._save_model()

            accuracy = (self.correct_predictions / self.feedback_count * 100) if self.feedback_count > 0 else 0.0
            action_name   = "ANOMALY" if predicted_action == 1 else "NORMAL"
            correct_name  = correct_severity or ("ANOMALY" if correct_label == 1 else "NORMAL")

            print(
                f"[SMART AGENT] Learning | "
                f"Predicted={action_name} | Correct={correct_name} | "
                f"WasRight={was_correct} | Replay={'YES' if replay_success else 'pending'} | "
                f"Accuracy={accuracy:.1f}% ({self.correct_predictions}/{self.feedback_count})"
            )

            return {
                "success": True,
                "feedback_type": feedback_type,
                "correct_severity": correct_severity,
                "predicted_action": predicted_action,
                "correct_label": correct_label,
                "was_model_correct": was_correct,
                "reward_applied": reward_for_correct,
                "replay_trained": replay_success,
                "model_saved": True,
                "feedback_count": self.feedback_count,
                "accuracy_pct": round(accuracy, 1)
            }

        except Exception as e:
            print(f"[SMART AGENT] [ERROR] Error in online training: {e}")
            return {"success": False, "reason": str(e)}

    def _replay(self):
        """
        Experience replay: randomly sample a minibatch from memory and train.
        Returns True if replay was performed.
        """
        try:
            minibatch = random.sample(self.replay_memory, REPLAY_BATCH_SIZE)

            states = np.array([exp[0] for exp in minibatch]).squeeze(axis=1)  # (batch, 8)
            actions = np.array([exp[1] for exp in minibatch])
            rewards = np.array([exp[2] for exp in minibatch])
            next_states = np.array([exp[3] for exp in minibatch]).squeeze(axis=1)
            dones = np.array([exp[4] for exp in minibatch])

            # Current Q-values
            targets = self.rl_model.predict_on_batch(states)
            next_q_values = self.rl_model.predict_on_batch(next_states)

            # Bellman update
            for i in range(REPLAY_BATCH_SIZE):
                if dones[i]:
                    targets[i][actions[i]] = rewards[i]
                else:
                    targets[i][actions[i]] = rewards[i] + GAMMA * np.amax(next_q_values[i])

            self.rl_model.fit(states, targets, epochs=1, verbose=0, batch_size=REPLAY_BATCH_SIZE)
            return True

        except Exception as e:
            print(f"[SMART AGENT] Replay Error: {e}")
            return False

    def _save_model(self):
        """Persist updated RL model to disk."""
        try:
            self.rl_model.save(RL_MODEL_PATH)
            print(f"[SMART AGENT] [SAVE] Model saved to {RL_MODEL_PATH}")
        except Exception as e:
            print(f"[SMART AGENT] [WARN] Could not save model: {e}")

    def get_training_stats(self):
        """Returns current online learning statistics."""
        accuracy = (self.correct_predictions / self.feedback_count * 100) if self.feedback_count > 0 else 0.0
        return {
            "feedback_count": self.feedback_count,
            "correct_predictions": self.correct_predictions,
            "accuracy_pct": round(accuracy, 1),
            "replay_buffer_size": len(self.replay_memory),
            "model_loaded": self.rl_model is not None
        }
