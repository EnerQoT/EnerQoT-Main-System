"""Test relay with multiple protocol options to find what works"""
import json, ssl, sys

def try_urllib(url, command):
    import urllib.request, urllib.error
    payload = json.dumps({"command": command}).encode("utf-8")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            print(f"  ✅ {url} → HTTP {resp.status}: {resp.read().decode()[:200]}")
            return True
    except Exception as e:
        print(f"  ❌ {url} → {type(e).__name__}: {e}")
        return False

def try_requests(url, command):
    try:
        import requests
        r = requests.post(url, json={"command": command}, headers={"Content-Type": "application/json"}, timeout=10, verify=False)
        print(f"  ✅ requests {url} → HTTP {r.status_code}: {r.text[:200]}")
        return True
    except Exception as e:
        print(f"  ❌ requests {url} → {type(e).__name__}: {e}")
        return False

cmd = sys.argv[1].upper() if len(sys.argv) > 1 else "ON"
print(f"=== Relay probe — command={cmd} ===\n")

# Try HTTPS
print("1. HTTPS via urllib:")
try_urllib("https://13.60.180.169/relay", cmd)

# Try HTTP
print("2. HTTP via urllib:")
try_urllib("http://13.60.180.169/relay", cmd)

# Try requests library (handles TLS better)
print("3. HTTPS via requests:")
try_requests("https://13.60.180.169/relay", cmd)

print("4. HTTP via requests:")
try_requests("http://13.60.180.169/relay", cmd)

print("\nAlso trying port 8080:")
try_urllib("http://13.60.180.169:8080/relay", cmd)
try_urllib("https://13.60.180.169:8080/relay", cmd)
