"""
Configuration management for Backend Service
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration"""
    
    # Service Configuration
    SERVICE_NAME = "BACKEND-SERVICE"
    SERVICE_PORT = int(os.getenv("BACKEND_SERVICE_PORT", "8001"))
    
    # MCP Server
    MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://3.141.18.225:3001")
    MCP_SERVER_TIMEOUT = int(os.getenv("MCP_SERVER_TIMEOUT", "30"))
    
    # Agent Service (for LLM-driven MCP interactions)
    AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://localhost:8006")
    
    # Firebase Configuration
    FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
    FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')
    FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL")
    
    # OAuth Configuration - Facebook
    FACEBOOK_CLIENT_ID = os.getenv("FACEBOOK_CLIENT_ID", "")
    FACEBOOK_CLIENT_SECRET = os.getenv("FACEBOOK_CLIENT_SECRET", "")
    FACEBOOK_REDIRECT_URI = os.getenv("FACEBOOK_REDIRECT_URI", "http://localhost:8000/api/integrations/facebook/callback")
    
    # OAuth Configuration - Twitter
    TWITTER_CLIENT_ID = os.getenv("TWITTER_CLIENT_ID", "")
    TWITTER_CLIENT_SECRET = os.getenv("TWITTER_CLIENT_SECRET", "")
    TWITTER_REDIRECT_URI = os.getenv("TWITTER_REDIRECT_URI", "http://localhost:8000/api/integrations/twitter/callback")
    
    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000").split(",")
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    # Use absolute path from project root
    LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs", "centralized.log")
    
    # Frontend
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    @classmethod
    def validate(cls):
        """Validate critical configuration"""
        errors = []
        
        if not cls.FIREBASE_PROJECT_ID:
            errors.append("FIREBASE_PROJECT_ID not set")
        
        if not cls.FIREBASE_PRIVATE_KEY or len(cls.FIREBASE_PRIVATE_KEY) < 50:
            errors.append("FIREBASE_PRIVATE_KEY not properly set")
        
        if not cls.FIREBASE_CLIENT_EMAIL:
            errors.append("FIREBASE_CLIENT_EMAIL not set")
        
        return errors

config = Config()
