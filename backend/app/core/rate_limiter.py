# backend/app/core/rate_limiter.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose: Rate limiting for API endpoints to prevent abuse

from fastapi import HTTPException, Request
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Simple in-memory rate limiter
    For production, use Redis for distributed rate limiting
    """
    
    def __init__(self):
        # Store: {api_key: {endpoint: [(timestamp, count)]}}
        self._requests: Dict[str, Dict[str, list]] = {}
        
        # Rate limits for Professional tier only
        # Tiers: free, starter, professional (only professional gets API access)
        self.LIMITS = {
            'professional': {
                'requests_per_hour': 1000,
                'requests_per_minute': 60,
                'requests_per_day': 10000
            }
        }
    
    def _clean_old_requests(self, api_key: str, endpoint: str, window_minutes: int = 60):
        """Remove requests older than the time window"""
        if api_key not in self._requests:
            return
        
        if endpoint not in self._requests[api_key]:
            return
        
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        self._requests[api_key][endpoint] = [
            (ts, count) for ts, count in self._requests[api_key][endpoint]
            if ts > cutoff
        ]
    
    def check_rate_limit(
        self,
        api_key: str,
        endpoint: str,
        tier: str = 'professional'
    ) -> tuple[bool, Optional[str]]:
        """
        Check if request is within rate limits
        
        Returns:
            (allowed: bool, error_message: Optional[str])
        """
        if tier not in self.LIMITS:
            tier = 'professional'
        
        limits = self.LIMITS[tier]
        now = datetime.utcnow()
        
        # Initialize tracking
        if api_key not in self._requests:
            self._requests[api_key] = {}
        if endpoint not in self._requests[api_key]:
            self._requests[api_key][endpoint] = []
        
        # Clean old requests
        self._clean_old_requests(api_key, endpoint, window_minutes=60)
        
        # Count requests in different windows
        requests = self._requests[api_key][endpoint]
        
        # Per minute check
        minute_ago = now - timedelta(minutes=1)
        requests_last_minute = sum(
            count for ts, count in requests if ts > minute_ago
        )
        
        if requests_last_minute >= limits['requests_per_minute']:
            return False, f"Rate limit exceeded: {limits['requests_per_minute']} requests per minute"
        
        # Per hour check
        hour_ago = now - timedelta(hours=1)
        requests_last_hour = sum(
            count for ts, count in requests if ts > hour_ago
        )
        
        if requests_last_hour >= limits['requests_per_hour']:
            return False, f"Rate limit exceeded: {limits['requests_per_hour']} requests per hour"
        
        # Per day check
        day_ago = now - timedelta(days=1)
        requests_last_day = sum(
            count for ts, count in requests if ts > day_ago
        )
        
        if requests_last_day >= limits['requests_per_day']:
            return False, f"Rate limit exceeded: {limits['requests_per_day']} requests per day"
        
        # Record this request
        self._requests[api_key][endpoint].append((now, 1))
        
        return True, None
    
    def get_usage_stats(self, api_key: str, endpoint: str) -> dict:
        """Get current usage statistics"""
        if api_key not in self._requests or endpoint not in self._requests[api_key]:
            return {
                'requests_last_minute': 0,
                'requests_last_hour': 0,
                'requests_last_day': 0
            }
        
        now = datetime.utcnow()
        requests = self._requests[api_key][endpoint]
        
        minute_ago = now - timedelta(minutes=1)
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)
        
        return {
            'requests_last_minute': sum(c for ts, c in requests if ts > minute_ago),
            'requests_last_hour': sum(c for ts, c in requests if ts > hour_ago),
            'requests_last_day': sum(c for ts, c in requests if ts > day_ago)
        }

# Global instance
rate_limiter = RateLimiter()


def check_rate_limit(api_key: str, endpoint: str, tier: str = 'professional'):
    """
    Dependency function to check rate limits
    Raises HTTPException if limit exceeded
    """
    allowed, error_msg = rate_limiter.check_rate_limit(api_key, endpoint, tier)
    
    if not allowed:
        logger.warning(f"Rate limit exceeded for API key {api_key[:10]}... on {endpoint}")
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "message": error_msg,
                "tier": tier,
                "limits": rate_limiter.LIMITS[tier]
            }
        )
    
    return True
