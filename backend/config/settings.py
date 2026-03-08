from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

MODEL_DIR = BASE_DIR / "model_artifacts"


IFOREST_PATH = MODEL_DIR / "device_agnostic_iforest.pkl"
SCALER_PATH = MODEL_DIR / "device_agnostic_scaler.pkl"

RL_MODEL_PATH = MODEL_DIR / "rl_model.keras"
RL_SCALER_PATH = MODEL_DIR / "device_agnostic_scaler_Rl.pkl"

WINDOW_SIZE = 20


PARTIAL_FACTOR = 0.7
