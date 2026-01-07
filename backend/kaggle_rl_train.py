
"""
KAGGLE REINFORCE LEARNING (RL) TRAINING SCRIPT
----------------------------------------------
This script is designed to be run in a Kaggle Notebook.
It trains a Deep Q-Network (DQN) Agent to detect anomalies in power grid data.

OUTPUTS:
1. rl_model.keras (The Brain)
2. device_agnostic_scaler.pkl (The Eyes - Required for the brain to see data correctly)

AUTHOR: EnerQoT AI Team
"""

# --- DEPENDENCY FIX FOR KAGGLE ---
# Fixes 'MessageFactory' object has no attribute 'GetPrototype' error
import os
import subprocess
import sys

def install_dependencies():
    print("Checking dependencies...")
    try:
        import google.protobuf
        if google.protobuf.__version__.startswith('4'):
            print("Downgrading protobuf to 3.20.3 to fix TensorFlow compatibility...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "protobuf==3.20.3"])
            print("Please RESTART the runtime (Kernel -> Restart) and run this again if it fails.")
    except ImportError:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "protobuf==3.20.3"])

install_dependencies()
# ---------------------------------

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, Input
from tensorflow.keras.optimizers import Adam
from collections import deque
import random
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
import glob
import warnings

# Suppress Warnings for cleaner output
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# ---------------------------------------------------------
# 1. CONFIGURATION
# ---------------------------------------------------------
# AUTO-DETECT DATASET FROM KAGGLE INPUT
KAGGLE_DIR = '/kaggle/input/household-appliances-factors-dataset'
found_files = glob.glob(f"{KAGGLE_DIR}/*.csv")

if found_files:
    DATASET_PATH = found_files[0]
    print(f"✅ Auto-detected dataset: {DATASET_PATH}")
else:
    # Fallback if running elsewhere
    DATASET_PATH = 'your_dataset.csv' 

# Hyperparameters
# OPTIMIZED FOR SPEED
EPISODES = 5        # Reduced from 10 to 5
BATCH_SIZE = 128    # Increased from 64 to 128 (Faster training on large data)
GAMMA = 0.95        
EPSILON_START = 1.0    
EPSILON_MIN = 0.01     
EPSILON_DECAY = 0.995  
LEARNING_RATE = 0.001

# Feature Parameters (Must match Backend)
SHORT_WINDOW = 5
LONG_WINDOW = 20

# ---------------------------------------------------------
# 2. DATA ENGINEERING
# ---------------------------------------------------------
def load_and_preprocess(filepath):
    print(f"Loading data from {filepath}...")
    try:
        df = pd.read_csv(filepath)
    except:
        df = pd.read_csv(filepath, encoding='ISO-8859-1') # Fallback
        
    print(f"Original Data Shape: {df.shape}")
    
    # Standardize columns
    df.columns = df.columns.str.strip().str.lower()
    
    # -------------------------------------------------------
    # ROBUST COLUMN MAPPING
    # -------------------------------------------------------
    column_map = {}
    for col in df.columns:
        if 'frequency' in col or 'freq' in col:
            column_map[col] = 'frequency'
        elif 'voltage' in col:
            column_map[col] = 'voltage_v'
        elif 'current' in col:
            column_map[col] = 'current_a'
        elif 'power_factor' in col or 'powerfactor' in col:
            column_map[col] = 'power_factor'
        elif 'temp' in col:
             column_map[col] = 'temperature'
             
    df = df.rename(columns=column_map)
    print(f"Mapped Columns: {df.columns.tolist()}")

    # Label Processing
    if 'issue_status' in df.columns:
        df['label'] = df['issue_status'].apply(lambda x: 0 if str(x).strip().lower() == 'no issue' else 1)
        print("Labels found! Using 'issue_status'.")
    else:
        print("WARNING: 'issue_status' not found. Training unsupervised.")
        df['label'] = 0

    # Sort
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.sort_values('timestamp')

    # Fill NaNs
    numeric_cols = ['voltage_v', 'current_a', 'frequency', 'power_factor', 'temperature'] 
    
    # Ensure purely numeric (drop strings like '230V')
    for c in numeric_cols:
        if c in df.columns:
            # Force numeric, coerce errors to NaN
            df[c] = pd.to_numeric(df[c], errors='coerce')
    
    df = df.ffill().bfill()
    
    # If still NaNs (empty file?), drop them
    df = df.dropna(subset=[c for c in numeric_cols if c in df.columns])
    
    print(f"Data Shape after cleaning: {df.shape}")
    return df

def feature_engineering(df):
    if df.empty:
        return df, []
        
    print("Engineering features...")
    df = df.copy()
    
    # Base Calc
    df['apparent_power'] = df['voltage_v'] * df['current_a']
    df['active_power_est'] = df['apparent_power'] * df['power_factor']
    
    if 'device_id' not in df.columns:
        df['device_id'] = 'unknown'
    
    # DEBUG: Check Device Distribution
    print(f"Unique Devices: {df['device_id'].nunique()}")
        
    def compute_rolling(group):
        try:
            # Sort just in case
            if 'timestamp' in group.columns:
                group = group.sort_values('timestamp')
            
            # Use min_periods=1 to support small groups
            group['p_mean'] = group['active_power_est'].rolling(SHORT_WINDOW, min_periods=1).mean().bfill()
            group['p_std'] = group['active_power_est'].rolling(SHORT_WINDOW, min_periods=1).std().fillna(0) # std can be nan if 1 sample
            
            # Avoid div/0
            group['norm_power'] = group['active_power_est'] / (group['p_mean'] + 1e-6)
            
            # Voltage Dev
            group['voltage_median'] = group['voltage_v'].rolling(LONG_WINDOW, min_periods=1).median().bfill()
            group['voltage_dev'] = (group['voltage_v'] - group['voltage_median']).abs()
            
            group['freq_dev'] = (group['frequency'] - 50).abs()
            
            # PF Instability
            group['pf_mean'] = group['power_factor'].rolling(SHORT_WINDOW, min_periods=1).mean().bfill()
            group['pf_instability'] = (group['power_factor'] - group['pf_mean']).abs()
            
            # Power Delta
            group['power_delta_norm'] = group['active_power_est'].diff().fillna(0) / (group['p_std'] + 1e-6)
            
            group['cv_ratio'] = group['current_a'] / group['voltage_v']
            
            # Energy Trend
            group['long_mean'] = group['active_power_est'].rolling(LONG_WINDOW, min_periods=1).mean().bfill()
            group['short_mean'] = group['active_power_est'].rolling(SHORT_WINDOW, min_periods=1).mean().bfill()
            group['energy_trend'] = group['long_mean'] - group['short_mean']
            
            # Temperature
            group['temperature_c'] = group['temperature']
            
            return group
        except Exception as e:
            return group

    # Fix for Pandas 2.2+ Deprecation Warning
    pd.set_option('mode.chained_assignment', None)
    df_feats = df.groupby('device_id', group_keys=False).apply(compute_rolling)
    
    feature_list = [
        "norm_power", "voltage_dev", "freq_dev", "pf_instability",
        "power_delta_norm", "cv_ratio", "energy_trend", "temperature_c"
    ]
    
    # Verify features exist
    missing_feats = [f for f in feature_list if f not in df_feats.columns]
    if missing_feats:
        print(f"WARNING: Missing features after engineering: {missing_feats}")
        
    return df_feats, feature_list

# ---------------------------------------------------------
# 3. RL AGENT DEFINITION (DQN)
# ---------------------------------------------------------
class DQN_Agent:
    def __init__(self, state_size, action_size=2):
        self.state_size = state_size
        self.action_size = action_size
        self.memory = deque(maxlen=2000)
        self.gamma = GAMMA
        self.epsilon = EPSILON_START
        self.epsilon_min = EPSILON_MIN
        self.epsilon_decay = EPSILON_DECAY
        self.learning_rate = LEARNING_RATE
        self.model = self._build_model()

    def _build_model(self):
        model = Sequential()
        # Input layer fixed using Input(shape)
        model.add(Input(shape=(self.state_size,)))
        model.add(Dense(32, activation='relu'))
        model.add(Dropout(0.2))
        model.add(Dense(32, activation='relu'))
        model.add(Dropout(0.2))
        model.add(Dense(self.action_size, activation='linear'))
        model.compile(loss='mse', optimizer=Adam(learning_rate=self.learning_rate))
        return model

    def remember(self, state, action, reward, next_state, done):
        self.memory.append((state, action, reward, next_state, done))

    def act(self, state):
        if np.random.rand() <= self.epsilon:
            return random.randrange(self.action_size)
        act_values = self.model.predict(state, verbose=0)
        return np.argmax(act_values[0])

    def replay(self, batch_size):
        if len(self.memory) < batch_size:
            return
        minibatch = random.sample(self.memory, batch_size)
        states = np.array([i[0] for i in minibatch]).squeeze()
        next_states = np.array([i[3] for i in minibatch]).squeeze()
        
        if states.ndim == 1: 
            states = states.reshape(1, -1)
            next_states = next_states.reshape(1, -1)
            
        targets = self.model.predict_on_batch(states)
        next_q_values = self.model.predict_on_batch(next_states)
        for i in range(len(minibatch)):
            action = minibatch[i][1]
            reward = minibatch[i][2]
            done = minibatch[i][4]
            target = reward
            if not done:
                target = reward + self.gamma * np.amax(next_q_values[i])
            targets[i][action] = target
        self.model.fit(states, targets, epochs=1, verbose=0)
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

# ---------------------------------------------------------
# 4. TRAINING LOOP
# ---------------------------------------------------------
def train_rl_agent():
    # A. PREPARE DATA
    df = load_and_preprocess(DATASET_PATH)
    if df.empty:
        print("❌ ABORTING: Dataframe is empty after loading.")
        return

    df_processed, feature_cols = feature_engineering(df)
    
    if not feature_cols or df_processed.empty:
        print("❌ ABORTING: No features generated.")
        return

    # Check for NaNs
    nan_count = df_processed[feature_cols].isna().sum().sum()
    if nan_count > 0:
        print(f"Warning: {nan_count} NaNs found. Dropping rows...")
        df_processed = df_processed.dropna(subset=feature_cols)

    print(f"Training on {len(df_processed)} samples.")
    if len(df_processed) == 0:
        print("❌ ABORTING: 0 samples remaining.")
        return
    
    # Convert to Numpy
    X = df_processed[feature_cols].values
    y = df_processed['label'].values 
    
    # B. SCALING
    from sklearn.preprocessing import StandardScaler
    scaler = StandardScaler()
    print(f"Fitting scaler on shape {X.shape}...")
    X_scaled = scaler.fit_transform(X)
    
    print("Saving Scaler...")
    joblib.dump(scaler, 'device_agnostic_scaler.pkl')
    
    # C. INITIALIZE AGENT
    state_size = len(feature_cols)
    agent = DQN_Agent(state_size=state_size, action_size=2)
    
    scores = []
    print("\n--- STARTING TRAINING ---")
    print(f"Algorithm: DQN | Episodes: {EPISODES} | Batch: {BATCH_SIZE}")
    
    for e in range(EPISODES):
        state = X_scaled[0].reshape(1, state_size)
        total_reward = 0
        
        # Limit loop to 5000 steps if dataset is massive to speed up
        max_steps = min(len(df_processed) - 1, 10000) 
        
        progress_interval = 500
        
        print(f"Episode {e+1} Progress: ", end="")
        
        for time_step in range(max_steps):
            if time_step % progress_interval == 0:
                print(".", end="", flush=True)
                
            action = agent.act(state)
            true_label = y[time_step]
            
            # Reward Logic
            # Higher penalties for missing real issues
            if true_label == 1: 
                reward = 10 if action == 1 else -10
            else: 
                reward = 1 if action == 0 else -2
            
            next_state = X_scaled[time_step + 1].reshape(1, state_size)
            done = (time_step == max_steps - 1)
            
            agent.remember(state, action, reward, next_state, done)
            state = next_state
            total_reward += reward
            
            # Optimization: Replay less frequently (every 200 steps) 
            # and only if memory is sufficient
            if len(agent.memory) > BATCH_SIZE and time_step % 200 == 0:
                agent.replay(BATCH_SIZE)
        
        print(f" Done. Score: {total_reward}")
        scores.append(total_reward)

    # D. SAVE MODEL
    print("Saving RL Model...")
    agent.model.save('rl_model.keras')
    print("Done! Artifacts generated:\n1. rl_model.keras\n2. device_agnostic_scaler.pkl")
    
    # E. VISUALIZATION
    plt.plot(scores)
    plt.title('Training Progress')
    plt.show()

# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
if __name__ == '__main__':
    if not os.path.exists(DATASET_PATH): 
        print(f"Dataset not found at {DATASET_PATH}.")
    else:
        train_rl_agent()
