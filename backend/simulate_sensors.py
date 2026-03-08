import time
import requests
import random
import sys

# Configuration
API_URL = "http://localhost:5000/sensor-data"
DEVICE_ID = "sensor_001"

def generate_normal_data():
    """Generates normal power grid data."""
    return {
        "device_id": DEVICE_ID,
        "voltage": round(random.gauss(230, 2), 2),      # ~230V
        "current": round(random.gauss(10, 0.5), 2),     # ~10A
        "frequency": round(random.gauss(50, 0.05), 2),  # ~50Hz
        "power_factor": round(random.uniform(0.9, 1.0), 2),
        "temperature": round(random.uniform(30, 45), 2)
    }

def generate_anomaly_data():
    """Generates anomalous data (e.g., voltage sag, overcurrent)."""
    type_ = random.choice(["sag", "swell", "overcurrent"])
    
    if type_ == "sag":
        return {
            "device_id": DEVICE_ID,
            "voltage": round(random.gauss(180, 5), 2),  # Low Voltage
            "current": round(random.gauss(12, 1), 2),   # Higher current compensating
            "frequency": round(random.gauss(49.5, 0.1), 2),
            "power_factor": round(random.uniform(0.7, 0.9), 2),
            "temperature": round(random.uniform(40, 55), 2)
        }
    elif type_ == "overcurrent":
        return {
            "device_id": DEVICE_ID,
            "voltage": round(random.gauss(220, 5), 2),
            "current": round(random.gauss(25, 2), 2),   # High Current
            "frequency": round(random.gauss(50, 0.1), 2),
            "power_factor": round(random.uniform(0.8, 0.95), 2),
            "temperature": round(random.uniform(60, 80), 2) # Overheating
        }
    else: # Swell
         return {
            "device_id": DEVICE_ID,
            "voltage": round(random.gauss(260, 5), 2), # High Voltage
            "current": round(random.gauss(8, 1), 2),
            "frequency": round(random.gauss(50.5, 0.1), 2),
            "power_factor": round(random.uniform(0.9, 1.0), 2),
            "temperature": round(random.uniform(35, 50), 2)
        }

def start_simulation():
    print(f"Starting Sensor Simulation for {DEVICE_ID}...")
    print(f"Target: {API_URL}")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            # 10% Chance of Anomaly
            if random.random() < 0.1:
                data = generate_anomaly_data()
                print(f"[ANOMALY] Sending: {data}")
            else:
                data = generate_normal_data()
                print(f"[NORMAL]  Sending: {data}")

            try:
                response = requests.post(API_URL, json=data)
                # print(f"Response: {response.status_code}")
            except requests.exceptions.ConnectionError:
                print("Error: Could not connect to backend. Is it running?")
            
            time.sleep(1) # Send every 1 second

    except KeyboardInterrupt:
        print("\nSimulation Stopped.")

if __name__ == "__main__":
    start_simulation()
