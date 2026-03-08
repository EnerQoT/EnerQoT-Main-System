"""
SCENARIO TEST: DQN Feedback Learning Loop
Demonstrates: normal data -> correct feedback, extreme data -> false alarm feedback -> learning
"""
import requests, json, sys

# Force UTF-8 output for Windows
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://127.0.0.1:5000'
DEVICE = 'test_device_01'
LINE = '=' * 60

def post_sensor(payload, n=8):
    """Send n readings to fill/refresh the buffer."""
    full = {**payload, 'device_id': DEVICE}
    result = {}
    for _ in range(n):
        r = requests.post(f'{BASE}/sensor-data', json=full, timeout=10)
        result = r.json()
    return result

def send_feedback(correct_label, feedback_type):
    r = requests.post(f'{BASE}/feedback', json={
        'device_id': DEVICE,
        'correct_label': correct_label,
        'feedback_type': feedback_type
    }, timeout=10)
    return r.json()

def get_stats():
    r = requests.get(f'{BASE}/agent-stats', timeout=5)
    return r.json().get('stats', {})

def print_result(label, d):
    score = d.get('anomaly_score', 'N/A')
    iforest = d.get('iforest_score', 'N/A')
    dqn = d.get('dqn_confidence', 'N/A')
    rl = d.get('rl_action', 'N/A')
    sev = d.get('severity', d.get('status', 'N/A'))
    mode = d.get('scoring_mode', 'N/A')
    print(f'  [{label}]')
    print(f'    scoring_mode : {mode}')
    print(f'    iForest score: {iforest}')
    safe_dqn = f'{float(dqn):.4f}' if dqn not in ('N/A', None) and str(dqn) != 'nan' else 'nan/N/A'
    print(f'    DQN conf     : {safe_dqn}')
    print(f'    RL action    : {rl}  [0=Normal, 1=Anomaly]')
    safe_score = f'{float(score):.4f}' if score not in ('N/A', None) and str(score) != 'nan' else str(score)
    print(f'    Combined score: {safe_score}')
    print(f'    Severity     : {sev}')
    return sev, rl

print(LINE)
print('  EnerQoT - DQN FEEDBACK LEARNING SCENARIO')
print(LINE)

# ------------------------------------------------------------------
# ROUND 1: Normal healthy data (temp=90)
# ------------------------------------------------------------------
print(f'\n{LINE}')
print('ROUND 1: NORMAL DATA (temp=90, all readings healthy)')
print(LINE)
normal = {'voltage': 230.0, 'current': 5.0, 'frequency': 50.0, 'power_factor': 0.95, 'temperature': 90.0}
r1 = post_sensor(normal)
r1_sev, r1_rl = print_result('Round 1 Prediction', r1)

if r1_sev in ('WARNING', 'CRITICAL'):
    print(f'\n  [USER] Model said {r1_sev} for NORMAL data. Sending FALSE_ALARM feedback.')
    fb1 = send_feedback(0, 'false_alarm')
    print(f'  Result: updated={fb1.get("model_updated")}, saved={fb1.get("model_saved")}')
else:
    print(f'\n  [USER] Model correctly said NORMAL. Sending CONFIRM feedback.')
    fb1 = send_feedback(0, 'confirm')   # label=0 means normal is correct
    print(f'  Result: updated={fb1.get("model_updated")}, saved={fb1.get("model_saved")}')

s1 = get_stats()
print(f'  Agent: count={s1["feedback_count"]}, accuracy={s1["accuracy_pct"]}%, replay_buf={s1["replay_buffer_size"]}')

# ------------------------------------------------------------------
# ROUND 2: EXTREME temperature (temp=900000) - same other readings
# ------------------------------------------------------------------
print(f'\n{LINE}')
print('ROUND 2: EXTREME DATA (temp=900000) - Model may miss it!')
print(LINE)
extreme = {'voltage': 230.0, 'current': 5.0, 'frequency': 50.0, 'power_factor': 0.95, 'temperature': 900000.0}
r2 = post_sensor(extreme)
r2_sev, r2_rl = print_result('Round 2 Prediction (BEFORE feedback)', r2)
r2_dqn = r2.get('dqn_confidence', 0)
r2_combined = r2.get('anomaly_score', 0)

print(f'\n  [USER] temp=900000 is DEFINITELY an anomaly. Giving feedback...')
# Tell model it was WRONG - this WAS an anomaly
print(f'  Step A: Sending false_alarm (model should NOT have said normal/warning for 900000 temp)')
fb2a = send_feedback(0, 'false_alarm')   # First tell it: don't do what you did
print(f'  Result A: updated={fb2a.get("model_updated")}, saved={fb2a.get("model_saved")}')
print(f'  Step B: Sending confirm anomaly (label=1) - teach it: THIS IS AN ANOMALY')
fb2b = send_feedback(1, 'confirm')       # Then: this should be anomaly
print(f'  Result B: updated={fb2b.get("model_updated")}, saved={fb2b.get("model_saved")}')

s2 = get_stats()
print(f'  Agent: count={s2["feedback_count"]}, correct={s2["correct_predictions"]}, accuracy={s2["accuracy_pct"]}%, replay_buf={s2["replay_buffer_size"]}')

# ------------------------------------------------------------------
# ROUND 3: Same extreme temp - did DQN learn?
# ------------------------------------------------------------------
print(f'\n{LINE}')
print('ROUND 3: Same extreme temp=900000 again after learning...')
print(LINE)
r3 = post_sensor(extreme, n=8)
r3_sev, r3_rl = print_result('Round 3 Prediction (AFTER feedback)', r3)
r3_dqn = r3.get('dqn_confidence', 0)
r3_combined = r3.get('anomaly_score', 0)

s3 = get_stats()

# ------------------------------------------------------------------
# COMPARISON
# ------------------------------------------------------------------
print(f'\n{LINE}')
print('  BEFORE vs AFTER LEARNING COMPARISON')
print(LINE)
def fmt(v): return f'{float(v):.4f}' if v not in (None, 'N/A', 'nan') and str(v) != 'nan' else str(v)
print(f'  {"Metric":<20} {"BEFORE":>12} {"AFTER":>12}')
print(f'  {"-"*44}')
print(f'  {"RL action":<20} {str(r2_rl):>12} {str(r3_rl):>12}   [1=Anomaly = GOOD]')
print(f'  {"DQN confidence":<20} {fmt(r2_dqn):>12} {fmt(r3_dqn):>12}')
print(f'  {"Combined score":<20} {fmt(r2_combined):>12} {fmt(r3_combined):>12}')
print(f'  {"Severity":<20} {str(r2_sev):>12} {str(r3_sev):>12}')

print(f'\n  Final agent stats:')
print(f'    Total feedback : {s3["feedback_count"]}')
print(f'    Correct preds  : {s3["correct_predictions"]}')
print(f'    Accuracy       : {s3["accuracy_pct"]}%')
print(f'    Replay buffer  : {s3["replay_buffer_size"]}')

# Verdict
if r3_rl == 1 and r2_rl == 0:
    print(f'\n  *** DQN LEARNED! Went from RL=0 (Normal) to RL=1 (Anomaly) ***')
elif r3_dqn and r2_dqn and float(str(r3_dqn)) > float(str(r2_dqn)):
    inc = float(str(r3_dqn)) - float(str(r2_dqn))
    print(f'\n  *** DQN PARTIALLY LEARNED: confidence increased by +{inc:.4f} ***')
    print(f'    More feedback sessions will push DQN to cross action=1 threshold.')
else:
    print(f'\n  NOTE: The DQN contributes 30% to the final score.')
    print(f'  The iForest (70%) is unsupervised and cannot be changed by feedback.')
    print(f'  For temp=900000 which is WAY outside training range, iForest may')
    print(f'  counterintuitively score it as NORMAL (isolated point = anomaly, but')
    print(f'  extreme outliers can fool iForest). DQN feedback over multiple sessions')
    print(f'  will gradually shift the combined score toward CRITICAL.')

print(f'\n{LINE}')
print('  HOW THE BRAIN LEARNS - TECHNICAL EXPLANATION')
print(LINE)
print('''
  Component         Weight  Trainable?   How
  -----------------------------------------------
  Isolation Forest    70%   NO           Pre-trained, never changes
  DQN (RL Agent)      30%   YES          User feedback => rewards => weights update

  DQN Reward Logic:
    User says "Confirm anomaly" (label=1):
      reward[action=1] = +10   (anomaly action was RIGHT)
      reward[action=0] = -10   (normal action was WRONG)
    User says "False Alarm" (label=0):
      reward[action=0] = +5    (normal action was RIGHT)
      reward[action=1] = -10   (anomaly action was WRONG)

  After each feedback:
    1. Immediate gradient step: Q-values updated toward rewards
    2. Experience saved to replay buffer
    3. When buffer >= 32: batch replay training (stronger learning)
    4. Model weights saved to disk (learning persists across restarts!)

  Important: The DQN learns patterns of raw sensor values (5 features).
  After many feedbacks on temp=900000 with label=1, its Q[ANOMALY] will
  dominate for similar readings, adding 0.30 to the combined score.
''')
