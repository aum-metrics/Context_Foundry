# backend/app/core/config.py
import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Production-grade configuration management using Pydantic Settings.
    Automatically loads from .env and validates types.
    """
    APP_NAME: str = "AUM Context Foundry"
    ENV: str = "development"  # production, development, testing
    DEBUG: bool = False
    
    # CORS & Hosts
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "https://aumdatalabs.com"]
    TRUSTED_HOSTS: List[str] = ["localhost", "127.0.0.1", "aumdatalabs.com"]
    
    # Security
    JWT_SECRET: str = "your-secret-key-change-in-production" # Default for Dev
    JWT_ALGORITHM: str = "HS256"
    JWT_EXP_MINUTES: int = 10080  # 7 days
    ALLOW_MOCK_AUTH: bool = True # Allowed in Dev by default
    
    # Provider Keys
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Payments
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    
    # Firebase
    FIREBASE_SERVICE_ACCOUNT_PATH: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def __init__(self, **values):
        super().__init__(**values)
        if self.ENV == "production":
            if self.JWT_SECRET == "your-secret-key-change-in-production":
                raise ValueError("🚨 CRITICAL: JWT_SECRET must be changed in production!")
            self.DEBUG = False
        else:
            self.DEBUG = True

settings = Settings()