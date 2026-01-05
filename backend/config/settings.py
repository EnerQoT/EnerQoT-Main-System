from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

MODEL_DIR = BASE_DIR / "model_artifacts"

IFOREST_PATH = MODEL_DIR / "device_agnostic_iforest.pkl"
SCALER_PATH = MODEL_DIR / "device_agnostic_scaler.pkl"

WINDOW_SIZE = 10
