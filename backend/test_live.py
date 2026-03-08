"""
Full pipeline verification: send 10 anomalous readings to fill buffer,
then verify hybrid scoring + feedback loop.
"""
import requests, json, sys, time

BASE = 'http://127.0.0.1:5000'

# Anomalous payload (high voltage, high temp, low PF, abnormal frequency)
anomalous = {
    'device_id': 'test_device_01',
    'voltage': 265.0,
    'current': 18.5,
    'frequency': 47.0,
    'power_factor': 0.4,
    'temperature': 58.0
}

print('=== Filling sensor buffer (10 anomalous readings) ===')
last_data = {}
for i in range(10):
    r = requests.post(f'{BASE}/sensor-data', json=anomalous, timeout=10)
    last_data = r.json()
    status = last_data.get('status', last_data.get('severity', '?'))
    print(f'  Reading {i+1:02d}: {status}')

print()
print('=== Final reading result ===')
print(json.dumps(last_data, indent=2))

print()
print('=== Hybrid Scoring Summary ===')
mode     = last_data.get('scoring_mode', 'N/A')
combined = last_data.get('anomaly_score', 'N/A')
iforest  = last_data.get('iforest_score', 'N/A')
dqn_conf = last_data.get('dqn_confidence', 'N/A')
rl_act   = last_data.get('rl_action', 'N/A')
severity = last_data.get('severity', 'N/A')
action   = last_data.get('action', 'N/A')

print(f'  Scoring mode  : {mode}')
print(f'  iForest score : {iforest}')
print(f'  DQN confidence: {dqn_conf}')
print(f'  RL action     : {rl_act}  (0=Normal, 1=Anomaly)')
print(f'  Combined score: {combined}')
print(f'  Severity      : {severity}')
print(f'  Action taken  : {action}')

hybrid_ok = mode == 'hybrid'
iforest_ok = isinstance(iforest, float) and 0 <= iforest <= 1
dqn_ok     = isinstance(dqn_conf, float) and 0 <= dqn_conf <= 1
combined_ok= isinstance(combined, float) and 0 <= combined <= 1

print()
print('=== Validation checks ===')
print(f'  [{"PASS" if hybrid_ok   else "FAIL"}] scoring_mode == hybrid')
print(f'  [{"PASS" if iforest_ok  else "FAIL"}] iforest_score in [0,1]')
print(f'  [{"PASS" if dqn_ok      else "FAIL"}] dqn_confidence in [0,1]')
print(f'  [{"PASS" if combined_ok else "FAIL"}] combined_score in [0,1]')

if severity in ('WARNING', 'CRITICAL'):
    print()
    print('=== Feedback: false_alarm ===')
    fb = requests.post(f'{BASE}/feedback', json={
        'device_id': 'test_device_01',
        'correct_label': 0,
        'feedback_type': 'false_alarm'
    }, timeout=10)
    fd = fb.json()
    print(json.dumps(fd, indent=2))
    print()
    updated = fd.get('model_updated')
    saved   = fd.get('model_saved')
    stats   = fd.get('training_stats', {})
    print(f'  [{"PASS" if updated else "FAIL"}] model_updated = {updated}')
    print(f'  [{"PASS" if saved   else "FAIL"}] model_saved   = {saved}')
    print(f'  Feedback count: {stats.get("feedback_count")}')
    print(f'  Accuracy      : {stats.get("accuracy_pct")}%')
    print()
    print('=== Feedback: confirm (anomaly) ===')
    fb2 = requests.post(f'{BASE}/feedback', json={
        'device_id': 'test_device_01',
        'correct_label': 1,
        'feedback_type': 'confirm'
    }, timeout=10)
    fd2 = fb2.json()
    stats2 = fd2.get('training_stats', {})
    print(f'  Feedback count: {stats2.get("feedback_count")}')
    print(f'  Accuracy      : {stats2.get("accuracy_pct")}%')
    print(f'  Was model correct: {fd2.get("was_model_correct")}')
else:
    print(f'\n  Severity is {severity} - scores computed but no anomaly detected')

print()
print('=== Agent Stats ===')
rs = requests.get(f'{BASE}/agent-stats', timeout=5)
print(json.dumps(rs.json(), indent=2))
print()
print('=== VERIFICATION COMPLETE ===')
