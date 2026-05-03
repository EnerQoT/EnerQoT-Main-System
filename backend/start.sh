#!/bin/bash
# Start the firebase bridge in the background
python firebase_bridge.py &

# Start gunicorn in the foreground
exec gunicorn --bind 0.0.0.0:5000 --workers 1 --threads 4 --timeout 120 run:app
