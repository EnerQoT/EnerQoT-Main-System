"""Quick test of the new correct_severity feedback endpoint"""
import requests, json
BASE = 'http://127.0.0.1:5000'
DEVICE = 'test_device_01'

# Fill buffer first
print("Filling sensor buffer...")
for _ in range(8):
    requests.post(f'{BASE}/sensor-data', json={
        'device_id': DEVICE, 'voltage': 265.0, 'current': 18.5,
        'frequency': 47.0, 'power_factor': 0.4, 'temperature': 900000.0
    }, timeout=10)
print("Done.")

print("\n=== Test 1: false_alarm WITHOUT correct_severity (should 400) ===")
r = requests.post(f'{BASE}/feedback/notification', json={
    'notification_id': '000000000000000000000000',
    'device_id': DEVICE,
    'feedback_type': 'false_alarm'
    # missing correct_severity
}, timeout=10)
print(f"Status: {r.status_code}, Body: {r.json()}")

print("\n=== Test 2: false_alarm WITH correct_severity=CRITICAL (graduated reward) ===")
r2 = requests.post(f'{BASE}/feedback', json={
    'device_id': DEVICE,
    'correct_label': 1,
    'feedback_type': 'false_alarm',
    'correct_severity': 'CRITICAL'
}, timeout=10)
d2 = r2.json()
print(f"Status: {r2.status_code}")
print(f"model_updated : {d2.get('model_updated')}")
print(f"model_saved   : {d2.get('model_saved')}")
print(f"correct_sev   : {d2.get('correct_severity')}")
print(f"reward_applied: {d2.get('reward_applied')}")
ts = d2.get('training_stats', {})
print(f"feedback_count: {ts.get('feedback_count')}")
print(f"accuracy      : {ts.get('accuracy_pct')}%")

print("\n=== Test 3: false_alarm WITH correct_severity=WARNING ===")
r3 = requests.post(f'{BASE}/feedback', json={
    'device_id': DEVICE,
    'correct_label': 1,
    'feedback_type': 'false_alarm',
    'correct_severity': 'WARNING'
}, timeout=10)
d3 = r3.json()
print(f"reward_applied: {d3.get('reward_applied')}  (should be less than CRITICAL)")
print(f"correct_sev   : {d3.get('correct_severity')}")

print("\n=== PASSED ===" if all([
    r.status_code == 400,                      # 400 without correct_severity
    d2.get('model_updated'),                   # model trained
    d2.get('reward_applied', 0) >= 10,         # CRITICAL gets high reward
]) else "\n=== SOME CHECKS FAILED ===")
