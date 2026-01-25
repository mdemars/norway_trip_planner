#!/bin/bash

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Using default configuration."
    echo "Create a .env file from .env.example and add your Google Maps API key."
fi

# Run the application
echo "Starting Trip Planner..."
echo "Application will be available at: http://localhost:5000"
echo "Press Ctrl+C to stop the server."
echo ""

python3 app.py
