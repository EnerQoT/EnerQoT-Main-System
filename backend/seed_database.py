"""
Seed MongoDB with historical data for EnerQoT
Generates realistic sensor data, anomalies, and tips
"""

from dotenv import load_dotenv
load_dotenv()

from datetime import datetime, timedelta, timezone
import random
from app.database import get_collection, SensorReading, Anomaly, Notification
from app.database.models import Device

def seed_device():
    """Create device entry"""
    devices = get_collection('devices')
    
    device = Device.create(
        "testdayve",
        "Main Grid Sensor",
        "Building A - Main Panel",
        "smart_meter"
    )
    
    # Check if exists
    existing = devices.find_one({"device_id": "testdayve"})
    if not existing:
        devices.insert_one(device)
        print("✅ Device created")
    else:
        print("ℹ️  Device already exists")

def seed_sensor_readings():
    """Generate 7 days of realistic sensor data"""
    sensor_readings = get_collection('sensor_readings')
    
    # Check if data already exists
    count = sensor_readings.count_documents({"device_id": "testdayve"})
    if count > 100:
        print(f"ℹ️  Sensor readings already exist ({count} documents)")
        return
    
    print("📊 Generating 7 days of sensor readings...")
    
    device_id = "testdayve"
    now = datetime.now(timezone.utc)
    readings = []
    
    # Generate data for last 7 days, every 5 minutes
    for day in range(7):
        for hour in range(24):
            for minute in [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]:
                timestamp = now - timedelta(days=6-day, hours=23-hour, minutes=55-minute)
                
                # Base values with daily patterns
                hour_factor = 1.0 + 0.3 * abs(12 - hour) / 12  # Peak at noon
                
                # Normal readings with some variation
                voltage = 230 + random.uniform(-5, 5) * hour_factor
                current = 8 + random.uniform(-2, 3) * hour_factor
                frequency = 50 + random.uniform(-0.2, 0.2)
                temperature = 35 + random.uniform(-5, 10) * hour_factor
                power_factor = 0.92 + random.uniform(-0.05, 0.05)
                
                # Inject some anomalies (5% chance)
                if random.random() < 0.05:
                    if random.random() < 0.5:
                        voltage += random.uniform(20, 40)  # Voltage spike
                    else:
                        temperature += random.uniform(15, 25)  # High temp
                
                reading = {
                    "device_id": device_id,
                    "timestamp": timestamp,
                    "voltage": round(voltage, 2),
                    "current": round(current, 2),
                    "frequency": round(frequency, 2),
                    "temperature": round(temperature, 1),
                    "power_factor": round(power_factor, 3),
                    "created_at": timestamp
                }
                
                readings.append(reading)
    
    # Insert in batches
    batch_size = 500
    for i in range(0, len(readings), batch_size):
        batch = readings[i:i+batch_size]
        sensor_readings.insert_many(batch)
        print(f"  Inserted {min(i+batch_size, len(readings))}/{len(readings)} readings")
    
    print(f"✅ Generated {len(readings)} sensor readings")

def seed_anomalies():
    """Generate historical anomalies"""
    anomalies_col = get_collection('anomalies')
    notifications_col = get_collection('notifications')
    
    count = anomalies_col.count_documents({"device_id": "testdayve"})
    if count > 5:
        print(f"ℹ️  Anomalies already exist ({count} documents)")
        return
    
    print("⚠️  Generating historical anomalies...")
    
    device_id = "testdayve"
    now = datetime.now(timezone.utc)
    
    anomaly_events = [
        (6, 14, 30, "WARNING", 0.55, "High temperature detected", "Alert sent to admin"),
        (5, 9, 15, "CRITICAL", 0.72, "Voltage spike detected", "Power cut initiated"),
        (4, 18, 45, "WARNING", 0.58, "High current detected", "Load reduction recommended"),
        (3, 22, 10, "CRITICAL", 0.68, "High temperature detected", "Emergency cooling activated"),
        (2, 11, 20, "WARNING", 0.52, "Voltage spike detected", "Alert sent to admin"),
        (1, 16, 35, "WARNING", 0.56, "High current detected", "Load monitoring enabled"),
        (0, 8, 50, "CRITICAL", 0.75, "Critical anomaly detected", "Power cut initiated"),
    ]
    
    for days_ago, hour, minute, severity, score, message, action in anomaly_events:
        timestamp = now - timedelta(days=days_ago, hours=hour, minutes=minute)
        
        anomaly = {
            "device_id": device_id,
            "timestamp": timestamp,
            "severity": severity,
            "anomaly_score": score,
            "action_taken": action,
            "features": {},
            "created_at": timestamp
        }
        anomalies_col.insert_one(anomaly)
        
        # Create corresponding notification
        notification = {
            "device_id": device_id,
            "timestamp": timestamp,
            "severity": severity,
            "title": f"{severity} Alert",
            "message": message,
            "action": action,
            "read": days_ago > 1,  # Mark older ones as read
            "created_at": timestamp
        }
        notifications_col.insert_one(notification)
    
    print(f"✅ Generated {len(anomaly_events)} anomalies and notifications")

def seed_tips():
    """Add energy-saving tips"""
    tips_col = get_collection('tips')
    
    count = tips_col.count_documents({})
    if count > 0:
        print(f"ℹ️  Tips already exist ({count} documents)")
        return
    
    print("💡 Adding energy-saving tips...")
    
    tips = [
        {
            "title": "Optimize AC Temperature",
            "description": "Set your AC to 24°C instead of 18°C. Each degree higher saves 6% energy.",
            "savings_potential": 15,
            "priority": 3,
            "category": "cooling",
            "icon": "thermometer"
        },
        {
            "title": "Use LED Bulbs",
            "description": "Replace incandescent bulbs with LED lights to reduce lighting costs by 75%.",
            "savings_potential": 12,
            "priority": 2,
            "category": "lighting",
            "icon": "lightbulb-o"
        },
        {
            "title": "Unplug Idle Devices",
            "description": "Devices on standby still consume power. Unplug chargers and appliances when not in use.",
            "savings_potential": 8,
            "priority": 2,
            "category": "general",
            "icon": "plug"
        },
        {
            "title": "Peak Hour Avoidance",
            "description": "Run heavy appliances during off-peak hours (10 PM - 6 AM) to save on electricity costs.",
            "savings_potential": 20,
            "priority": 3,
            "category": "timing",
            "icon": "clock-o"
        },
        {
            "title": "Regular Maintenance",
            "description": "Clean AC filters monthly and service appliances regularly for optimal efficiency.",
            "savings_potential": 10,
            "priority": 2,
            "category": "maintenance",
            "icon": "wrench"
        },
        {
            "title": "Smart Power Strips",
            "description": "Use smart power strips to automatically cut power to devices in standby mode.",
            "savings_potential": 7,
            "priority": 1,
            "category": "automation",
            "icon": "flash"
        },
        {
            "title": "Natural Ventilation",
            "description": "Use natural ventilation during cooler hours instead of AC to reduce energy consumption.",
            "savings_potential": 18,
            "priority": 3,
            "category": "cooling",
            "icon": "leaf"
        },
        {
            "title": "Energy-Efficient Appliances",
            "description": "Upgrade to 5-star rated appliances for long-term energy savings.",
            "savings_potential": 25,
            "priority": 3,
            "category": "appliances",
            "icon": "star"
        }
    ]
    
    tips_col.insert_many(tips)
    print(f"✅ Added {len(tips)} energy-saving tips")

def main():
    """Run all seed functions"""
    print("\n🌱 Seeding MongoDB database...\n")
    
    seed_device()
    seed_sensor_readings()
    seed_anomalies()
    seed_tips()
    
    print("\n🎉 Database seeding complete!\n")
    
    # Print summary
    sensor_readings = get_collection('sensor_readings')
    anomalies = get_collection('anomalies')
    notifications = get_collection('notifications')
    tips = get_collection('tips')
    
    print("📊 Database Summary:")
    print(f"  Sensor Readings: {sensor_readings.count_documents({})}")
    print(f"  Anomalies: {anomalies.count_documents({})}")
    print(f"  Notifications: {notifications.count_documents({})}")
    print(f"  Tips: {tips.count_documents({})}")
    print()

if __name__ == "__main__":
    main()
