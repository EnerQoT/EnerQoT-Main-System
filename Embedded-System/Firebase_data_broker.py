import paho.mqtt.client as mqtt
import json
import time
from firebase_admin import credentials, initialize_app, db
from datetime import datetime
import pytz  # Added for timezone support

# MQTT Broker details (adjust if needed)
MQTT_BROKER = "localhost"  # Since running on the same Ubuntu instance
MQTT_PORT = 1883
MQTT_TOPIC = "sensor/data"
MQTT_USER = ""  # If auth enabled
MQTT_PASS = ""  # If auth enabled

# Firebase details
FIREBASE_SERVICE_ACCOUNT_KEY = "/path/to/your/serviceAccountKey.json"  # Replace with actual path
FIREBASE_DATABASE_URL = "https://your-project-id-default-rtdb.firebaseio.com/"  # Replace with your DB URL

# Initialize Firebase
cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_KEY)
initialize_app(cred, options={'databaseURL': FIREBASE_DATABASE_URL})

# Sri Lanka timezone
SL_TZ = pytz.timezone('Asia/Colombo')

# MQTT callback functions
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"Connection failed with code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8')
        data = json.loads(payload)
        timestamp = datetime.now(SL_TZ).isoformat()
        
        # Push data to Firebase under /sensor_data with timestamp as key
        ref = db.reference('/sensor_data')
        new_entry = ref.push({
            'timestamp': timestamp,
            'pzem': data.get('pzem', {}),
            'ina3221': data.get('ina3221', {}),
            'si7021': data.get('si7021', {})
        })
        print(f"Data sent to Firebase: {new_entry.key}")
    except Exception as e:
        print(f"Error processing message: {e}")

# Set up MQTT client
client = mqtt.Client()
if MQTT_USER and MQTT_PASS:
    client.username_pw_set(MQTT_USER, MQTT_PASS)
client.on_connect = on_connect
client.on_message = on_message

# Connect to broker
client.connect(MQTT_BROKER, MQTT_PORT, 60)

# Start the loop
client.loop_forever()
