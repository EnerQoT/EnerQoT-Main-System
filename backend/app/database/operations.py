"""
Database Operations for handling specific document insertions and updates
"""

import logging
from .connection import get_collection
from .models import DailyUsage, Tip

logger = logging.getLogger(__name__)

def store_daily_usage(device_id: str, date: str, total_kwh: float, cost: float = 0.0) -> bool:
    """
    Store or update daily energy usage for a device
    
    Args:
        device_id (str): ID of the device
        date (str): Date string (e.g., 'YYYY-MM-DD')
        total_kwh (float): Total energy consumption in kWh
        cost (float): Cost associated with the usage
        
    Returns:
        bool: True if successful, False otherwise
    """
    collection = get_collection('daily_usage')
    if collection is None:
        logger.error("Cannot store daily usage: Database not connected")
        return False
        
    usage_doc = DailyUsage.create(device_id, date, total_kwh, cost)
    
    try:
        # Use upsert to replace existing entry for the same device and date
        collection.update_one(
            {"device_id": device_id, "date": date},
            {"$set": usage_doc},
            upsert=True
        )
        logger.info(f"Stored daily usage for device {device_id} on {date}")
        return True
    except Exception as e:
        logger.error(f"Error storing daily usage: {e}")
        return False

def store_tip(device_id: str, title: str, description: str, category: str = "general") -> bool:
    """
    Store an energy saving tip
    
    Args:
        device_id (str): ID of the target device
        title (str): Title of the tip
        description (str): Detailed tip description
        category (str): Category (e.g., 'general', 'hvac', 'lighting')
        
    Returns:
        bool: True if successful, False otherwise
    """
    collection = get_collection('tips')
    if collection is None:
        logger.error("Cannot store tip: Database not connected")
        return False
        
    tip_doc = Tip.create(device_id, title, description, category)
    
    try:
        collection.insert_one(tip_doc)
        logger.info(f"Stored tip for device {device_id}: {title}")
        return True
    except Exception as e:
        logger.error(f"Error storing tip: {e}")
        return False
