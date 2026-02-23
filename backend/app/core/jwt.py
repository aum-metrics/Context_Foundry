# backend/app/core/jwt.py
"""
JWT token creation and validation
"""

from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from fastapi import HTTPException, status, Header
import logging

logger = logging.getLogger(__name__)

# Import settings
try:
    from app.core.config import settings
except ImportError:
    from .config import settings


class TokenData(BaseModel):
    """JWT Token payload"""
    sub: Optional[str] = None  # Subject (user email)
    exp: Optional[int] = None  # Expiration timestamp


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create JWT access token
    
    Args:
        data: Payload to encode
        expires_delta: Custom expiration time
        
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_EXP_MINUTES
        )
    
    to_encode.update({"exp": int(expire.timestamp())})
    
    try:
        encoded_jwt = jwt.encode(
            to_encode,
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM
        )
        return encoded_jwt
    except Exception as e:
        logger.error(f"Failed to create JWT token: {e}")
        raise


def decode_access_token(
    authorization: Optional[str] = Header(None)
) -> TokenData:
    """
    Decode and validate JWT access token from Authorization header
    
    Args:
        authorization: Authorization header value
        
    Returns:
        TokenData with decoded payload
        
    Raises:
        HTTPException if token is invalid or expired
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Parse "Bearer <token>"
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid auth scheme")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Decode token
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        return TokenData(
            sub=sub,
            exp=payload.get("exp")
        )
        
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        logger.error(f"Unexpected JWT error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )