
import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import RobustScaler
from app.models.rl_model import DQN_Agent
import joblib

# Configuration
EPISODES = 5
BATCH_SIZE = 32
WINDOW_SIZE = 20
MODEL_DIR = "model_artifacts"
RL_MODEL_PATH = os.path.join(MODEL_DIR, "rl_model.keras")

def load_and_preprocess_data(csv_path):
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    df = df.fillna(method="ffill")
    
    # Filter
    df = df[
        (df["voltage_V"] > 0) &
        (df["current_A"] > 0) &
        (df["frequency_Hz"] > 0) &
        (df["power_factor"] > 0) &
        (df["power_factor"] <= 1)
    ].reset_index(drop=True)

    # 1. Feature Engineering (Same logic as compute_features but batch)
    short_w, long_w = 5, 20
    
    df["apparent_power"] = df["voltage_V"] * df["current_A"]
    df["active_power_est"] = df["apparent_power"] * df["power_factor"]

    df["p_mean"] = df["active_power_est"].rolling(short_w).mean().bfill()
    df["p_std"]  = df["active_power_est"].rolling(short_w).std().bfill()

    df["norm_power"] = df["active_power_est"] / (df["p_mean"] + 1e-6)
    df["voltage_dev"] = (df["voltage_V"] - df["voltage_V"].median()).abs()
    df["freq_dev"] = (df["frequency_Hz"] - 50).abs()

    df["pf_instability"] = (
        df["power_factor"] -
        df["power_factor"].rolling(short_w).mean().bfill()
    ).abs()

    df["power_delta_norm"] = (
        df["active_power_est"].diff().fillna(0) /
        (df["p_std"] + 1e-6)
    )

    df["cv_ratio"] = df["current_A"] / df["voltage_V"]

    df["energy_trend"] = (
        df["active_power_est"].rolling(long_w).mean().bfill() -
        df["active_power_est"].rolling(short_w).mean().bfill()
    )

    FEATURES = [
        "norm_power", "voltage_dev", "freq_dev", "pf_instability",
        "power_delta_norm", "cv_ratio", "energy_trend", "temperature_C"
    ]
    
    return df, FEATURES

def train_rl(csv_path):
    # 1. Prepare Data
    df, features_list = load_and_preprocess_data(csv_path)
    X = df[features_list].values
    
    # Proxy Labels for Reward Calculation
    if "issue_status" in df.columns:
        y = (df["issue_status"] != "No Issue").astype(int).values
    else:
        print("Warning: 'issue_status' column not found. Using dummy rewards (unsupervised-ish).")
        y = np.zeros(len(df)) # Fallback

    # Scale Data
    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Save Scaler for Inference
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(scaler, os.path.join(MODEL_DIR, "device_agnostic_scaler.pkl"))

    # 2. Initialize Agent
    state_size = len(features_list)
    agent = DQN_Agent(state_size, action_size=2)
    
    # 3. Training Loop
    print("Starting Training...")
    
    for e in range(EPISODES):
        state = X_scaled[0].reshape(1, state_size)
        total_reward = 0
        
        for t in range(len(df) - 1):
            # Action: 0 = Normal, 1 = Anomaly
            action = agent.act(state)
            
            # Label
            true_label = y[t]
            
            # Reward System
            # TP (Predicted Anomaly, Is Anomaly) -> +10
            # TN (Predicted Normal, Is Normal) -> +1
            # FP (Predicted Anomaly, Is Normal) -> -1
            # FN (Predicted Normal, Is Anomaly) -> -10 (Critical Miss)
            
            if action == true_label:
                reward = 10 if action == 1 else 1
            else:
                reward = -10 if true_label == 1 else -1

            next_state = X_scaled[t+1].reshape(1, state_size)
            done = (t == len(df) - 2)
            
            agent.remember(state, action, reward, next_state, done)
            state = next_state
            total_reward += reward
            
            if len(agent.memory) > BATCH_SIZE and t % 100 == 0:
                agent.replay(BATCH_SIZE)
        
        print(f"Episode {e+1}/{EPISODES} - Total Reward: {total_reward} - Epsilon: {agent.epsilon:.2f}")
        
    # 4. Save Model
    agent.save(RL_MODEL_PATH)
    print("Training Complete!")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", help="Path to the training CSV file")
    args = parser.parse_args()
    
    train_rl(args.csv_path)
