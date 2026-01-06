"""
Test MongoDB Connection
Run this to verify MongoDB Atlas connection is working
"""

# Load environment variables FIRST before any other imports
from dotenv import load_dotenv
load_dotenv()

import os

# Now import database connection
from app.database.connection import db_instance, get_db, is_db_connected

def test_connection():
    """Test MongoDB connection"""
    print("🔍 Testing MongoDB Connection...")
    print(f"Database Name: {os.getenv('MONGODB_DATABASE')}")
    
    if is_db_connected():
        print("✅ Successfully connected to MongoDB!")
        
        # Test database operations
        db = get_db()
        
        # Insert a test document
        test_collection = db.test
        result = test_collection.insert_one({"test": "connection", "timestamp": "2024-01-06"})
        print(f"✅ Test document inserted with ID: {result.inserted_id}")
        
        # Read it back
        doc = test_collection.find_one({"test": "connection"})
        print(f"✅ Test document retrieved: {doc}")
        
        # Delete it
        test_collection.delete_one({"_id": result.inserted_id})
        print("✅ Test document deleted")
        
        # List collections
        collections = db.list_collection_names()
        print(f"📁 Available collections: {collections}")
        
        print("\n🎉 MongoDB connection test PASSED!")
        return True
    else:
        print("❌ Failed to connect to MongoDB")
        print("⚠️  Make sure:")
        print("   1. .env file exists in backend folder")
        print("   2. MONGODB_URI is correct")
        print("   3. IP is whitelisted in MongoDB Atlas (0.0.0.0/0)")
        return False

if __name__ == "__main__":
    test_connection()
