#!/bin/bash

echo "============================================"
echo "Trip Planner - Setup Script"
echo "============================================"
echo ""

# Check Python version
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed."
    echo "Please install Python 3.8 or higher and try again."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "Found Python $PYTHON_VERSION"
echo ""

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
if [ $? -ne 0 ]; then
    echo "Error: Failed to create virtual environment."
    exit 1
fi
echo "Virtual environment created successfully!"
echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo ""

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip
echo ""

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies."
    exit 1
fi
echo "Dependencies installed successfully!"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ".env file created!"
    echo ""
    echo "IMPORTANT: Please edit the .env file and add your Google Maps API key."
    echo ""
else
    echo ".env file already exists."
    echo ""
fi

# Initialize database
echo "Initializing database..."
python3 -c "from models import init_db; init_db()"
if [ $? -ne 0 ]; then
    echo "Error: Failed to initialize database."
    exit 1
fi
echo "Database initialized successfully!"
echo ""

echo "============================================"
echo "Setup completed successfully!"
echo "============================================"
echo ""
echo "To get started:"
echo "1. Edit the .env file and add your Google Maps API key"
echo "2. Activate the virtual environment: source venv/bin/activate"
echo "3. Run the application: python3 app.py"
echo "4. Open your browser to: http://localhost:5000"
echo ""
echo "For more information, see README.md"
echo ""
