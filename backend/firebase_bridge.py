import time
import requests
import json
import os
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, db

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------
FIREBASE_DB_URL = "https://rp-project-51690-default-rtdb.asia-southeast1.firebasedatabase.app/"
LOCAL_API_URL = "http://127.0.0.1:5000/sensor-data"

# Initialize Firebase Admin
cred_path = os.path.join(os.path.dirname(__file__), "config", "firebase_credentials.json")
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {
            'databaseURL': FIREBASE_DB_URL
        })
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
DEVICE_ID = "test_device_01"
POLL_INTERVAL_SECONDS = 2  # How often to check for new data

# Keep track of the last processed record key so we don't send duplicates
last_processed_key = None

def fetch_and_forward():
    global last_processed_key
    
    try:
        # 1. Fetch latest record from Firebase using Admin SDK
        ref = db.reference('sensor_data')
        data = ref.order_by_key().limit_to_last(1).get()
        
        if not data:
            return

        # Firebase limitToLast=1 returns a dict with one key-value pair
        # Example: {"-OnDed...": {"pzem": {...}, "si7021": {...}, ...}}
        record_key = list(data.keys())[0]
        record = data[record_key]

        # Check if we already processed this exact reading
        if record_key == last_processed_key:
            return
            
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] New data found in Firebase (Key: {record_key})")
        
        # TEMPORARY LOG FOR TESTING: Print exact data from Firebase
        print("--- FIREBASE RAW DATA ---")
        print(json.dumps(record, indent=2))
        print("-------------------------")
        
        last_processed_key = record_key

        try:
            pzem = record.get("pzem", {})
            si7021 = record.get("si7021", {})
            
            # The root object has the relay status, e.g. {"pzem": {...}, "relay": "ON", ...}
            relay_status = record.get("relay", "ON")  # Default to ON if missing
            
            voltage = float(pzem.get("voltage", 0.0))
            current = float(pzem.get("current", 0.0))
            frequency = float(pzem.get("frequency", 0.0))
            pf = float(pzem.get("pf", 0.0))
            temperature = float(si7021.get("temperature", 0.0))
            
            # 3. Construct the payload for our local backend
            payload = {
                "device_id": DEVICE_ID,
                "voltage": voltage,
                "current": current,
                "frequency": frequency,
                "power_factor": pf,
                "temperature": temperature,
                "relay_status": relay_status,
                "pzem": pzem,
                "si7021": si7021,
                "ina3221": record.get("ina3221", {}),
                "system": record.get("system", {})
            }
            
            # 4. Forward to the local API
            api_response = requests.post(
                LOCAL_API_URL, 
                json=payload, 
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            if api_response.status_code in [200, 201]:
                print(f"  ✅ Successfully forwarded to backend API: {voltage}V, {current}A, {temperature}°C")
            else:
                print(f"  ❌ Backend API rejected data: HTTP {api_response.status_code} - {api_response.text}")

        except requests.ConnectionError:
            print(f"  ❌ Backend API unreachable at {LOCAL_API_URL}. Is the local server running?")
        except requests.Timeout:
            print(f"  ❌ Backend API connection timed out.")
        except Exception as e:
            print(f"  ⚠️ Error processing/sending data: {e}")

    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Network Error: {e}")

if __name__ == "__main__":
    print("-" * 60)
    print("🔥 EnerQoT Firebase -> Local API Bridge Started 🔥")
    print(f"Polling Firebase every {POLL_INTERVAL_SECONDS} seconds...")
    print(f"Target Local API: {LOCAL_API_URL}")
    print("-" * 60)
    
    while True:
        fetch_and_forward()
        time.sleep(POLL_INTERVAL_SECONDS)
