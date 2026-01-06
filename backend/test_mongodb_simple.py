"""Simple MongoDB connection test"""
from dotenv import load_dotenv
load_dotenv()

import os
from pymongo import MongoClient

# Get connection string
mongodb_uri = os.getenv('MONGODB_URI')
database_name = os.getenv('MONGODB_DATABASE', 'enerqot')

print(f"🔍 Testing MongoDB Connection...")
print(f"Database Name: {database_name}")
print(f"URI starts with: {mongodb_uri[:30] if mongodb_uri else 'NOT FOUND'}...")

try:
    # Create client
    client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
    
    # Test connection
    client.admin.command('ping')
    print("✅ Successfully connected to MongoDB!")
    
    # Get database
    db = client[database_name]
    
    # Test insert
    result = db.test.insert_one({"test": "connection"})
    print(f"✅ Test document inserted: {result.inserted_id}")
    
    # Test read
    doc = db.test.find_one({"test": "connection"})
    print(f"✅ Test document retrieved: {doc}")
    
    # Clean up
    db.test.delete_one({"_id": result.inserted_id})
    print("✅ Test document deleted")
    
    # List collections
    collections = db.list_collection_names()
    print(f"📁 Collections: {collections}")
    
    print("\n🎉 MongoDB connection test PASSED!")
    client.close()
    
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print("\n⚠️  Troubleshooting:")
    print("   1. Check .env file exists")
    print("   2. Verify MONGODB_URI is correct")
    print("   3. Whitelist IP in MongoDB Atlas (0.0.0.0/0)")
