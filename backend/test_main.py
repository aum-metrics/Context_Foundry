import sys
import os
# Hard path injection to ensure app module is found correctly in CI
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from fastapi import FastAPI
from app.main import app

test = FastAPI()
# Simple router check to ensure the app loaded correctly
assert app.router is not None
print("STARTUP OK")
