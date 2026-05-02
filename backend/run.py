import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Ensure bridge is only started once when Flask reload is active
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        print("Starting Firebase Bridge as a background process...")
        # Start the bridge so their logs show together in the same terminal
        subprocess.Popen([sys.executable, "firebase_bridge.py"])

    app.run(host="0.0.0.0", port=5000, debug=True)
