import sys
import os
# Inject backend root into path so 'from app.main' works consistently in CI
BACKEND_ROOT = os.path.dirname(os.path.abspath(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from fastapi import FastAPI
from app.main import app

test = FastAPI()
# Simple router check to ensure the app loaded correctly
assert app.router is not None
print("STARTUP OK")
