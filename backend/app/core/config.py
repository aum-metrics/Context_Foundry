# backend/app/core/config.py
import os
from typing import List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    APP_NAME: str = "AUM Context Foundry"
    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = ENV == "development"
    
    # CORS - Handle both comma-separated and list
    cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    CORS_ORIGINS: List[str] = [origin.strip() for origin in cors_origins_str.split(",")]
    
    # Frontend URL for links
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Supabase (Phasing out in favor of Firestore)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXP_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Firebase
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")

    def __init__(self):
        # Validation
        if self.ENV == "production":
            if self.JWT_SECRET == "your-secret-key-change-in-production":
                raise ValueError("JWT_SECRET must be changed in production!")

settings = Settings()