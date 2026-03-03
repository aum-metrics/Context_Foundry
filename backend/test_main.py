import sys
import os
sys.path.append(os.path.abspath('app'))
from fastapi import FastAPI
from app.main import app

test = FastAPI()
app.router
print("STARTUP OK")
