import numpy as np
import pandas as pd

def compute_features(buffer):
    """
    Computes the 8 features required by the model from a buffer of sensor data.
    Buffer should be a list/deque of dicts with:
    voltage, current, frequency, power_factor, temperature
    """
    df = pd.DataFrame(list(buffer))
    
    # Ensure columns exist and numeric
    cols = ["voltage", "current", "frequency", "power_factor", "temperature"]
    for c in cols:
        df[c] = pd.to_numeric(df[c])

    # Rename to match training script expected names
    df = df.rename(columns={
        "voltage": "voltage_V",
        "current": "current_A",
        "frequency": "frequency_Hz", 
        "temperature": "temperature_C"
    })

    # Parameters
    short_w = 5
    long_w = 20 
    
    # If buffer is smaller than long_w, we might get NaNs, but we use bfill()
    # However, for a single inference point (the last one), we need history.
    
    # --- Feature Engineering (Same as User Snippet) ---
    df["apparent_power"] = df["voltage_V"] * df["current_A"]
    df["active_power_est"] = df["apparent_power"] * df["power_factor"]

    # Rolling windows
    df["p_mean"] = df["active_power_est"].rolling(short_w).mean().bfill()
    df["p_std"]  = df["active_power_est"].rolling(short_w).std().bfill()

    # Behavioral indicators
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

    # Select the last row (current state)
    last = df.iloc[-1]

    features = [
        last["norm_power"],
        last["voltage_dev"],
        last["freq_dev"],
        last["pf_instability"],
        last["power_delta_norm"],
        last["cv_ratio"],
        last["energy_trend"],
        last["temperature_C"]
    ]

    return np.array(features).reshape(1, -1)
