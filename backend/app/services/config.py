import os

# Base Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(os.path.dirname(BASE_DIR), "model_artifacts")

# Constants
PARTIAL_FACTOR = 0.7  # For projecting partially incomplete daily data
