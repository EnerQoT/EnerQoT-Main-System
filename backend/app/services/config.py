import os

# Base Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "database")

# Simulator Config
SIMULATED_DATA_PATH = os.path.join(MODELS_DIR, "simulated_iot_data.csv")

# Constants
PARTIAL_FACTOR = 0.7  # For projecting partially incomplete daily data
