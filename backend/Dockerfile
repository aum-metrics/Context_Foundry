# Author: "Sambath Kumar Natarajan"
# Date: "26-Dec-2025"
# Org: " Start-up/AUM Data Labs"
# Product: "Context Foundry"
# Description: Dockerfile for Python GEO Backend Engine

# Use official Python lightweight image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for PyPDF and ML models
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the SentenceTransformer model to bake it into the image (saves startup time)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy the rest of the application
COPY . .

# Expose the standard FastAPI port
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
