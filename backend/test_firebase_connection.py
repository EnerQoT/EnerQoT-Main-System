
import sys
import os

# Add parent directory to path so we can import from app
sys.path.append(os.getcwd())

from app.services.firebase_service import firebase_service
import json

print("--- Testing Firebase Connection ---")
try:
    data = firebase_service.get_latest_sensor_data()
    print("Result Type:", type(data))
    print("Result Content:", json.dumps(data, indent=2, default=str))
    
    if data is None:
        print("❌ Data is None. Check credentials and database URL.")
    else:
        print("✅ Data fetched successfully.")
        
        # Check for expected fields
        if 'pzem' in data:
            print("✅ 'pzem' field found.")
        else:
            print("❌ 'pzem' field MISSING.")
            
        if 'ina3221' in data:
             print("✅ 'ina3221' field found.")
        else:
             print("❌ 'ina3221' field MISSING.")

except Exception as e:
    print(f"❌ Exception occurred: {e}")
