import numpy as np

def compute_features(buffer):
    voltages = np.array([x["voltage"] for x in buffer])
    currents = np.array([x["current"] for x in buffer])
    freqs = np.array([x["frequency"] for x in buffer])
    pfs = np.array([x["power_factor"] for x in buffer])
    temps = np.array([x["temperature"] for x in buffer])

    apparent_power = voltages * currents
    active_power = apparent_power * pfs

    p_mean = active_power.mean()
    p_std = active_power.std() + 1e-6

    features = [
        active_power[-1] / p_mean,
        abs(voltages[-1] - np.median(voltages)),
        abs(freqs[-1] - 50),
        abs(pfs[-1] - pfs.mean()),
        (active_power[-1] - active_power[-2]) / p_std if len(active_power) > 1 else 0,
        currents[-1] / voltages[-1],
        p_mean - active_power.mean(),
        temps[-1]
    ]

    return np.array(features).reshape(1, -1)
