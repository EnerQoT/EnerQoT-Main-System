
import firebase_admin
from firebase_admin import credentials, db
import os
import json
from dotenv import load_dotenv

load_dotenv()

class FirebaseService:
    def __init__(self):
        self._initialize_app()
        self.db_url = os.getenv('FIREBASE_DATABASE_URL')
        if not self.db_url:
            print("Warning: FIREBASE_DATABASE_URL not set in environment.")

    def _initialize_app(self):
        # Check if already initialized
        if firebase_admin._apps:
            return

        api_key_path = os.getenv('FIREBASE_CREDENTIALS_PATH', 'config/firebase_credentials.json')
        
        # Absolute path check
        if not os.path.isabs(api_key_path):
            api_key_path = os.path.join(os.getcwd(), api_key_path)

        if os.path.exists(api_key_path):
            try:
                cred = credentials.Certificate(api_key_path)
                firebase_admin.initialize_app(cred, {
                    'databaseURL': os.getenv('FIREBASE_DATABASE_URL')
                })
                print(f"Firebase initialized with credentials from {api_key_path}")
            except Exception as e:
                print(f"Failed to initialize Firebase: {e}")
        else:
            print(f"Firebase credentials file not found at {api_key_path}")

    def get_latest_sensor_data(self):
        """
        Fetches the most recent sensor data entry from Firebase.
        Assumes keys are chronological (Push IDs) or uses timestamp if indexed.
        Using orderByKey().limitToLast(1) for efficiency.
        """
        try:
            ref = db.reference('/sensor_data') # Assuming data is stored under sensor_data
            # Query for the last 1 item ordered by key (Push IDs are chronological)
            snapshot = ref.order_by_key().limit_to_last(1).get()
            
            if not snapshot:
                return None

            # Snapshot is a dict { "key": {data} }
            # However, if the query returns a parent node containing multiple children (e.g. unexpected grouping),
            # we need to drill down to find the actual sensor data.
            
            # Start with the value of the fetched item
            key = list(snapshot.keys())[0]
            data = snapshot[key]
            
            # Helper to check if data looks like a sensor reading
            def is_sensor_reading(d):
                return isinstance(d, dict) and ('pzem' in d or 'ina3221' in d)

            # If the extracted data isn't a reading, maybe it's a collection of readings.
            # We sort keys and take the last one, repeating until we find a reading or run out of depth.
            # Limit depth to avoid infinite loops.
            depth = 0
            while not is_sensor_reading(data) and isinstance(data, dict) and depth < 3:
                if not data:
                    return None
                # Take the lexicographically last key (assuming Push IDs or ISO timestamps)
                last_key = sorted(data.keys())[-1]
                data = data[last_key]
                depth += 1
                
            return data
            
        except Exception as e:
            print(f" Error fetching data from Firebase: {e}")
            return None

    def get_first_reading_of_day(self):
        """
        Fetches the first sensor data entry for the current day.
        Useful for determining the energy baseline at midnight.
        """
        try:
            from datetime import datetime
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            
            ref = db.reference('/sensor_data')
            # Query for the first item after midnight
            snapshot = ref.order_by_child('timestamp').start_at(today_start).limit_to_first(1).get()
            
            if not snapshot:
                return None
                
            key = list(snapshot.keys())[0]
            return snapshot[key]
        except Exception as e:
            print(f" Error fetching first reading of day: {e}")
            return None

firebase_service = FirebaseService()
