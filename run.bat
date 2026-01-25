@echo off

REM Activate virtual environment
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else (
    echo Virtual environment not found. Please run setup.bat first.
    pause
    exit /b 1
)

REM Check if .env exists
if not exist .env (
    echo Warning: .env file not found. Using default configuration.
    echo Create a .env file from .env.example and add your Google Maps API key.
)

REM Run the application
echo Starting Trip Planner...
echo Application will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server.
echo.

python app.py
pause
