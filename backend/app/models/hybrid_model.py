
import joblib
import numpy as np
import os
import tensorflow as tf
from config.settings import IFOREST_PATH, SCALER_PATH, MODEL_DIR
from app.models.rl_model import DQN_Agent

class HybridAnomalyModel:
    def __init__(self):
        self.load_models()

    def load_models(self):
        # Load Scaler
        if os.path.exists(SCALER_PATH):
            self.scaler = joblib.load(SCALER_PATH)
        else:
            print("Warning: Scaler not found.")
            self.scaler = None

        # Load iForest
        if os.path.exists(IFOREST_PATH):
            self.iforest = joblib.load(IFOREST_PATH)
        else:
            print("Warning: iForest model not found.")
            self.iforest = None

        # Load RL Model
        # We need to know state size to init DQN_Agent. 
        # Assuming 8 features as per current engineering.
        self.rl_agent = DQN_Agent(state_size=8)
        rl_path = os.path.join(MODEL_DIR, "rl_model.keras")
        if os.path.exists(rl_path):
            try:
                self.rl_agent.load(rl_path)
                self.rl_agent.epsilon = 0.0 # Force deterministic inference
            except Exception as e:
                print(f"Error loading RL model: {e}")
        else:
            print(f"Warning: RL model not found at {rl_path}")

    def score(self, features):
        """
        Returns a combined anomaly score (0.0 to 1.0) and severity.
        features: numpy array shape (1, 8)
        """
        if self.scaler is None:
            print("ERROR: Scaler is NOT loaded. Returning 0.0 score.")
            return 0.0

        X_scaled = self.scaler.transform(features)

        # 1. iForest Score
        if_score_norm = 0.0
        if self.iforest:
            raw_score = -self.iforest.decision_function(X_scaled)[0]
            # Normalize roughly: decision function is approx [-0.5, 0.5] usually
            # We map it to [0, 1]
            if_score_norm = max(0.0, min(1.0, (raw_score + 0.5)))

        # 2. RL Agent Action
        # Agent returns 1 for Anomaly, 0 for Normal
        # But we can also look at Q-values for finer granularity if we want.
        # For now, let's trust the action.
        rl_action = self.rl_agent.act(X_scaled) # 0 or 1
        
        # Hybrid Logic
        # If RL says Anomaly (1) -> It's a strong signal (based on reward/label).
        # If iForest says Anomaly (high score) -> It's a statistical outlier.
        
        # We can say: if RL triggers, it's definitely an anomaly.
        # If iForest is very high, it's also an anomaly.
        
        final_score = if_score_norm
        
        if rl_action == 1:
            # RL detected a known anomaly pattern
            final_score = max(final_score, 0.9) 
            
        return final_score

    def train_online(self, features, correct_label):
        """
        Online learning adjustment based on user feedback.
        correct_label: 0 (Normal) or 1 (Anomaly)
        """
        # If user says it's Normal (0), but we predicted Anomaly -> False Positive.
        # We want to encourage Action 0.
        # State = features
        # Action = correct_label
        # Reward = +10 (Big reward for being correct)
        
        # We treat 'next_state' as same as state for this instant correction (simplification)
        state = self.scaler.transform(features)
        action = correct_label
        reward = 10.0
        next_state = state
        done = False
        
        # 1. Modify Memory
        self.rl_agent.remember(state, action, reward, next_state, done)
        
        # 2. Trigger immediate training step (Replay)
        # We use a small batch size (e.g., 16) or just 1 if memory is small
        current_mem_size = len(self.rl_agent.memory)
        batch_size = min(32, current_mem_size)
        
        if batch_size > 0:
            # DEBUG: Check prediction BEFORE training
            q_values_before = self.rl_agent.model.predict(state, verbose=0)
            
            self.rl_agent.replay(batch_size)
            
            # DEBUG: Check prediction AFTER training
            q_values_after = self.rl_agent.model.predict(state, verbose=0)
            
            print(f"[Adaptive Learning] Feedback: Label={correct_label}")
            print(f"   -> Q-Values Before: {q_values_before[0]}")
            print(f"   -> Q-Values After:  {q_values_after[0]}")
            print(f"   -> Model updated successfully.")
            
        # Optional: Save the updated model occasionally
        # self.rl_agent.save(os.path.join(MODEL_DIR, "updated_rl_model.keras"))
