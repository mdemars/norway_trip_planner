@echo off
echo ============================================
echo Trip Planner - Setup Script
echo ============================================
echo.

REM Check Python installation
echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH.
    echo Please install Python 3.8 or higher and try again.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo Found Python %PYTHON_VERSION%
echo.

REM Create virtual environment
echo Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo Error: Failed to create virtual environment.
    pause
    exit /b 1
)
echo Virtual environment created successfully!
echo.

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo.

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip
echo.

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo Error: Failed to install dependencies.
    pause
    exit /b 1
)
echo Dependencies installed successfully!
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo .env file created!
    echo.
    echo IMPORTANT: Please edit the .env file and add your Google Maps API key.
    echo.
) else (
    echo .env file already exists.
    echo.
)

REM Initialize database
echo Initializing database...
python -c "from models import init_db; init_db()"
if errorlevel 1 (
    echo Error: Failed to initialize database.
    pause
    exit /b 1
)
echo Database initialized successfully!
echo.

echo ============================================
echo Setup completed successfully!
echo ============================================
echo.
echo To get started:
echo 1. Edit the .env file and add your Google Maps API key
echo 2. Activate the virtual environment: venv\Scripts\activate
echo 3. Run the application: python app.py
echo 4. Open your browser to: http://localhost:5000
echo.
echo For more information, see README.md
echo.
pause
