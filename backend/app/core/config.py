# backend/app/core/config.py
import os
from typing import List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    APP_NAME: str = "AUM Backend"
    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = ENV == "development"
    
    # CORS - Handle both comma-separated and list
    cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    CORS_ORIGINS: List[str] = [origin.strip() for origin in cors_origins_str.split(",")]
    
    # Frontend URL for links
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    # Razorpay
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXP_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # SMTP
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    
    # UPI
    UPI_ID: str = os.getenv("UPI_ID", "merchant@upi")
    
    def __init__(self):
        # Validation
        if self.ENV == "production":
            if self.JWT_SECRET == "your-secret-key-change-in-production":
                raise ValueError("JWT_SECRET must be changed in production!")
            if not self.SUPABASE_URL or not self.SUPABASE_KEY:
                print("⚠️  WARNING: Supabase not configured in production")

settings = Settings()