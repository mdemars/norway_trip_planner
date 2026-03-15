import os
from dotenv import load_dotenv
import re

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration class"""

    # Flask configuration
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

    # Session configuration
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 604800  # 7 days

    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///database.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Google Maps API
    GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY', '')

    # Google OAuth 2.0
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')

    # Microsoft OAuth 2.0
    MICROSOFT_CLIENT_ID = os.getenv('MICROSOFT_CLIENT_ID', '')
    MICROSOFT_CLIENT_SECRET = os.getenv('MICROSOFT_CLIENT_SECRET', '')

    # Allowed email addresses (comma-separated in env)
    ALLOWED_EMAILS = [
        e.strip().lower()
        for e in os.getenv('ALLOWED_EMAILS', '').split(',')
        if e.strip()
    ]

    @staticmethod
    def get_safe_db_uri():
        """Get database URI with password masked for safe logging."""
        uri = Config.SQLALCHEMY_DATABASE_URI
        
        # Mask password in connection strings
        # Pattern: user:password@host -> user:***@host
        masked_uri = re.sub(
            r'(://)([^:/@]+):([^@/]+)(@)',
            r'\1\2:***\4',
            uri
        )
        return masked_uri

    @staticmethod
    def validate():
        """Validate required configuration"""
        # Print database configuration
        print(f"Database URI: {Config.get_safe_db_uri()}")
        
        if not Config.GOOGLE_MAPS_API_KEY:
            print("WARNING: GOOGLE_MAPS_API_KEY not set. Distance calculations will not work.")
            print("Please set it in your .env file or environment variables.")
        if not Config.GOOGLE_CLIENT_ID or not Config.GOOGLE_CLIENT_SECRET:
            print("WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. OAuth login will not work.")
            print("Please set them in your .env file or environment variables.")
        if not Config.ALLOWED_EMAILS:
            print("WARNING: ALLOWED_EMAILS is empty. No users will be able to log in.")
            print("Set a comma-separated list of emails in your .env file.")
