# backend/app/core/config.py
import os
import sys
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Production-grade configuration management using Pydantic Settings.
    Automatically loads from .env and validates types.
    """
    APP_NAME: str = "AUM Context Foundry"
    ENV: str = "production"  # production, development, testing
    DEBUG: bool = False
    API_V1_STR: str = "/api"
    FRONTEND_URL: str = "http://localhost:3000" # fallback
    
    # CORS & Hosts
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://aumcontextfoundry.com",
        "https://www.aumcontextfoundry.com",
        "https://app.aumcontextfoundry.com",
        "https://api.aumcontextfoundry.com",
    ]
    TRUSTED_HOSTS: List[str] = [
        "localhost",
        "127.0.0.1",
        "aumcontextfoundry.com",
        "www.aumcontextfoundry.com",
        "app.aumcontextfoundry.com",
        "api.aumcontextfoundry.com",
        "*.aumcontextfoundry.com",
        "*.run.app"
    ]
    
    # Security
    JWT_SECRET: str = "your-secret-key-change-in-production" # Default for Dev
    SSO_ENCRYPTION_KEY: str = "aum-sso-encryption-dev-fallback1" # Dev default for Fernet encryption
    SSO_JWT_SECRET: str = "aum-sso-jwt-intent-dev-fallback1" # Separated intent token key
    JWT_ALGORITHM: str = "HS256"
    JWT_EXP_MINUTES: int = 10080  # 7 days
    ALLOW_MOCK_AUTH: bool = False # 🛡️ SECURITY HARDENING (P0): Disabled by default, actively blocked in security.py if ENV=production
    
    # Provider Keys
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Payments
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    
    # Firebase & Supabase
    FIREBASE_SERVICE_ACCOUNT_PATH: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def __init__(self, **values):
        super().__init__(**values)
        if self.ENV == "production":
            # 🛡️ SECURITY ADVISORY (P0): In production, these should never be default.
            # Hard-fail if any default secrets are present.
            invalid = []
            if self.JWT_SECRET == "your-secret-key-change-in-production":
                invalid.append("JWT_SECRET")
            if self.SSO_ENCRYPTION_KEY == "aum-sso-encryption-dev-fallback1":
                invalid.append("SSO_ENCRYPTION_KEY")
            if self.SSO_JWT_SECRET == "aum-sso-jwt-intent-dev-fallback1":
                invalid.append("SSO_JWT_SECRET")
            if self.ALLOW_MOCK_AUTH:
                invalid.append("ALLOW_MOCK_AUTH must be False in production")
            if invalid:
                print(f"🚨 CRITICAL SECURITY ALERT: Security violations detected in production: {', '.join(invalid)}")
                sys.exit(1)
            self.DEBUG = False
        else:
            self.DEBUG = True

settings = Settings()
