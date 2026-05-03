import os
import sys

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# Provide the URI if not present
if "MONGODB_URI" not in os.environ:
    os.environ["MONGODB_URI"] = "mongodb+srv://u2000_db_user:llJrS8kIEROGAzvN@cluster0.2tqf5iq.mongodb.net/enerqot?retryWrites=true&w=majority"
    
import logging
from app.database import is_db_connected, store_daily_usage, store_tip

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_tests():
    if not is_db_connected():
        logger.error("Database is not connected. Exiting early.")
        return
        
    logger.info("Database is connected. Running tests...")
    
    # Test storing daily usage
    device_id = "test_device_001"
    date_str = "2023-10-27"
    usage_res = store_daily_usage(
        device_id=device_id,
        date=date_str,
        total_kwh=12.5,
        cost=1.85
    )
    if usage_res:
        logger.info(f"Successfully stored daily usage for device {device_id} on {date_str}")
    else:
        logger.error("Failed to store daily usage")
        
    # Test storing a tip
    tip_res = store_tip(
        device_id=device_id,
        title="Reduce standby power",
        description="Unplug appliances when not in use to save on standby power costs.",
        category="general"
    )
    if tip_res:
        logger.info("Successfully stored energy saving tip")
    else:
        logger.error("Failed to store tip")
        
    if usage_res and tip_res:
        logger.info("All tests passed successfully!")

if __name__ == "__main__":
    run_tests()
