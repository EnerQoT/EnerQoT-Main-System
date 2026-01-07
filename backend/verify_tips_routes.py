import requests
import json
import time

BASE_URL = "http://localhost:5000/api/tips"

def test_health():
    print(f"Testing Health Endpoint: {BASE_URL}/health")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        if response.status_code == 200:
            print("✅ Health Check Passed")
        else:
            print("❌ Health Check Failed")
    except Exception as e:
        print(f"❌ Health Check Error: {e}")
    print("-" * 30)

def test_telemetry():
    print(f"Testing Telemetry Endpoint: {BASE_URL}/telemetry")
    payload = {"device": "AC", "usage": 4.5}
    try:
        response = requests.post(f"{BASE_URL}/telemetry", json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        if response.status_code == 201:
             print("✅ Telemetry Passed")
        else:
             print("❌ Telemetry Failed")
    except Exception as e:
        print(f"❌ Telemetry Error: {e}")
    print("-" * 30)

def test_endpoints():
    endpoints = ["forecast", "top-devices", "recommendations", "all"]
    for ep in endpoints:
        print(f"Testing {ep.title()}: {BASE_URL}/{ep}")
        try:
            response = requests.get(f"{BASE_URL}/{ep}")
            print(f"Status: {response.status_code}")
            # Limit output length
            data = response.json()
            print(f"Response Keys: {list(data.keys()) if isinstance(data, dict) else 'List of items'}")
            
            if response.status_code == 200:
                 print(f"✅ {ep.title()} Passed")
            else:
                 print(f"❌ {ep.title()} Failed")
        except Exception as e:
            print(f"❌ {ep.title()} Error: {e}")
        print("-" * 30)

if __name__ == "__main__":
    print("Wait for server restart...")
