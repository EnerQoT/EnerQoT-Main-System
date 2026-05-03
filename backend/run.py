import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

from app import create_app
from apscheduler.schedulers.background import BackgroundScheduler
from daily_train_firebase import main as run_training

app = create_app()

# Initialize the scheduler
scheduler = BackgroundScheduler()

# Add the training job: Runs once a day (every 24 hours)
# We use 'interval' here, but you can also use 'cron' for a specific time of day.
scheduler.add_job(func=run_training, trigger="interval", hours=24)

if __name__ == "__main__":
    # Start the scheduler
    scheduler.start()
    print("Automated Daily Training Scheduler Started.")
    
    # Run the Flask app
    # Note: use_reloader=False is used to prevent the scheduler from starting twice
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
    # Ensure bridge is only started once when Flask reload is active
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        print("Starting Firebase Bridge as a background process...")
        # Start the bridge so their logs show together in the same terminal
        subprocess.Popen([sys.executable, "firebase_bridge.py"])

    app.run(host="0.0.0.0", port=5000, debug=True)
