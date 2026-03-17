# backend/app/core/logging_config.py
import logging
import sys
import os
from logging.handlers import RotatingFileHandler
from core.config import settings

def setup_logging():
    """
    Sets up a production-ready logging configuration.
    Includes console and rotating file handlers.
    """
    log_format = "%(asctime)s | %(name)s | %(levelname)s | [%(env)s] | %(message)s"
    
    # Custom filter to add environment to log records
    class EnvFilter(logging.Filter):
        def filter(self, record):
            record.env = settings.ENV
            return True

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO if not settings.DEBUG else logging.DEBUG)
    
    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(log_format))
    console_handler.addFilter(EnvFilter())
    root_logger.addHandler(console_handler)
    
    # File Handlers - Disabled for Cloud Run to avoid write issues & persistent storage lack.
    # We rely on Standard Output (Console Handler) which Cloud Logging captures.

    # Suppress verbose logs from external libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("google").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)

    return root_logger
