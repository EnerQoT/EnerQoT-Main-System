
import joblib
import numpy as np
import os
from config.settings import IFOREST_PATH, SCALER_PATH

# Weight for combining iForest and DQN scores
# DQN at 50% means user feedback corrections kick in faster.
# Tradeoff: a fresh model without feedback will rely more on DQN guesses.
IFOREST_WEIGHT = 0.55
DQN_WEIGHT = 0.45

class HybridAnomalyModel:
    def __init__(self):
        self.load_models()

    def load_models(self):
        # Load Scaler (for iForest)
        if os.path.exists(SCALER_PATH):
            self.scaler = joblib.load(SCALER_PATH)
        else:
            print("Warning: iForest Scaler not found.")
            self.scaler = None

        # Load iForest
        if os.path.exists(IFOREST_PATH):
            self.iforest = joblib.load(IFOREST_PATH)
        else:
            print("Warning: iForest model not found.")
            self.iforest = None

    def iforest_score(self, features):
        """
        Returns an anomaly score (0.0 to 1.0) based on Isolation Forest alone.
        features: numpy array shape (1, 8)
        Returns: float [0, 1] — higher = more anomalous
        """
        if self.scaler is None or self.iforest is None:
            return 0.0

        try:
            X_scaled = self.scaler.transform(features)
            # decision_function < 0 → Anomaly. Map: score = 0.5 - raw_score
            raw_score = self.iforest.decision_function(X_scaled)[0]
            anomaly_score = 0.5 - raw_score
            return float(np.clip(anomaly_score, 0.0, 1.0))
        except Exception as e:
            print(f"Error in iForest scoring: {e}")
            return 0.0

    def score(self, features):
        """
        Legacy method — returns iForest score alone.
        Use combined_score() for full hybrid scoring when DQN is available.
        """
        return self.iforest_score(features)

    def combined_score(self, features, dqn_q_values=None):
        """
        Returns a unified hybrid anomaly score [0, 1] combining:
          - Isolation Forest score (70% weight)
          - DQN confidence from Q-values (30% weight)

        Args:
            features:      numpy array shape (1, 8)
            dqn_q_values:  numpy array shape (2,) — [Q(normal), Q(anomaly)]
                           If None, falls back to iForest-only scoring.

        Returns:
            dict with keys:
              - combined_score:   float [0, 1]  — primary anomaly score
              - iforest_score:    float [0, 1]
              - dqn_confidence:   float [0, 1]  — DQN's probability of anomaly
              - dqn_action:       int (0=Normal, 1=Anomaly)
              - mode:             str ("hybrid" | "iforest_only")
        """
        if_score = self.iforest_score(features)

        if dqn_q_values is not None:
            try:
                q = np.array(dqn_q_values, dtype=np.float64)

                # Guard: reject NaN or Inf Q-values (fall back to iForest-only)
                if not np.all(np.isfinite(q)):
                    print(f"[HybridModel] DQN Q-values not finite ({q}) - using iForest only.")
                    return {
                        "combined_score": if_score,
                        "iforest_score": if_score,
                        "dqn_confidence": 0.0,
                        "dqn_action": 0,
                        "mode": "iforest_only"
                    }

                # Stable softmax with epsilon guard
                q_shifted = q - np.max(q)
                exp_q = np.exp(q_shifted)
                softmax_q = exp_q / (np.sum(exp_q) + 1e-9)
                dqn_confidence = float(np.clip(softmax_q[1], 0.0, 1.0))
                dqn_action = int(np.argmax(q))

                # Weighted combination
                score = IFOREST_WEIGHT * if_score + DQN_WEIGHT * dqn_confidence
                score = float(np.clip(score, 0.0, 1.0))

                return {
                    "combined_score": score,
                    "iforest_score": if_score,
                    "dqn_confidence": dqn_confidence,
                    "dqn_action": dqn_action,
                    "mode": "hybrid"
                }
            except Exception as e:
                print(f"[HybridModel] Error combining DQN scores: {e}. Falling back to iForest.")

        # iForest-only fallback
        return {
            "combined_score": if_score,
            "iforest_score": if_score,
            "dqn_confidence": 0.0,
            "dqn_action": 0,
            "mode": "iforest_only"
        }

    def train_online(self, features, correct_label):
        """
        Placeholder for Isolation Forest online learning.
        Actual online RL training is handled by SmartAgent.train_online().
        """
        pass
