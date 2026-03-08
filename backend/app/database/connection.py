"""
MongoDB Database Connection Module
Handles connection to MongoDB Atlas and provides database access
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, ConfigurationError
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class MongoDB:
    """MongoDB connection manager"""
    
    def __init__(self):
        self.client = None
        self.db = None
        self._connect()
    
    def _connect(self):
        """Establish connection to MongoDB"""
        try:
            # Get connection string from environment
            mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
            database_name = os.getenv('MONGODB_DATABASE', 'enerqot')
            
            # Create client with timeout
            self.client = MongoClient(
                mongodb_uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000
            )
            
            # Test connection
            self.client.admin.command('ping')
            
            # Get database
            self.db = self.client[database_name]
            
            logger.info(f"✅ Connected to MongoDB database: {database_name}")
            
            # Create indexes
            self._create_indexes()
            
        except (ConnectionFailure, ServerSelectionTimeoutError, ConfigurationError) as e:
            logger.error(f"❌ Failed to connect to MongoDB: {e}")
            logger.warning("⚠️  Running without database - using in-memory storage")
            self.db = None
    
    def _create_indexes(self):
        """Create database indexes for optimal query performance"""
        if self.db is None:
            return
        
        try:
            # Sensor readings indexes
            self.db.sensor_readings.create_index([
                ("device_id", ASCENDING),
                ("timestamp", DESCENDING)
            ])
            self.db.sensor_readings.create_index("timestamp")
            
            # Anomalies indexes
            self.db.anomalies.create_index([
                ("device_id", ASCENDING),
                ("timestamp", DESCENDING)
            ])
            self.db.anomalies.create_index("severity")
            
            # Notifications indexes
            self.db.notifications.create_index([
                ("device_id", ASCENDING),
                ("timestamp", DESCENDING)
            ])
            self.db.notifications.create_index("read")
            self.db.notifications.create_index("severity")
            
            # Users indexes
            self.db.users.create_index("email", unique=True)
            
            # User feedback indexes
            self.db.user_feedback.create_index([
                ("device_id", ASCENDING),
                ("timestamp", DESCENDING)
            ])
            
            # Devices indexes
            self.db.devices.create_index("device_id", unique=True)
            
            logger.info("✅ Database indexes created successfully")
            
        except Exception as e:
            logger.error(f"❌ Error creating indexes: {e}")
    
    def get_collection(self, collection_name):
        """Get a collection from the database"""
        if self.db is None:
            return None
        return self.db[collection_name]
    
    def is_connected(self):
        """Check if database is connected"""
        return self.db is not None
    
    def close(self):
        """Close database connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")


# Global database instance
db_instance = MongoDB()


def get_db():
    """Get database instance"""
    return db_instance.db


def get_collection(name):
    """Get a specific collection"""
    return db_instance.get_collection(name)


def is_db_connected():
    """Check if database is connected"""
    return db_instance.is_connected()
