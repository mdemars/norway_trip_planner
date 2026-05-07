@echo off
REM Post-deployment setup script for Windows
REM Run this after: git pull origin main

echo.
echo 🚀 Post-Deployment Initialization
echo ==================================
echo.

REM Ensure directories exist
echo 📁 Ensuring critical directories exist...
python ensure_directories.py
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to initialize directories!
    exit /b 1
)

echo.
echo ✅ Post-deployment setup complete!
echo.
echo Next steps:
echo 1. Update dependencies: pip install -r requirements.txt
echo 2. Restart your application
