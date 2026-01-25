#!/usr/bin/env python3
"""
Database initialization script for Trip Planner
"""

import sys
from models import init_db, engine, Base

def reset_database():
    """Drop all tables and recreate them"""
    print("WARNING: This will delete all existing data!")
    response = input("Are you sure you want to reset the database? (yes/no): ")
    
    if response.lower() != 'yes':
        print("Database reset cancelled.")
        return
    
    print("Dropping all tables...")
    Base.metadata.drop_all(engine)
    print("Creating new tables...")
    Base.metadata.create_all(engine)
    print("Database reset complete!")

def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == '--reset':
        reset_database()
    else:
        print("Initializing database...")
        init_db()
        print("Database initialized successfully!")
        print("\nTo reset the database and delete all data, run:")
        print("python init_db.py --reset")

if __name__ == '__main__':
    main()
