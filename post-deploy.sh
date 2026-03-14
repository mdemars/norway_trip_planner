#!/bin/bash
# Post-deployment setup script for Linux/Mac environments
# Run this after: git pull origin main

echo "🚀 Post-Deployment Initialization"
echo "=================================="
echo ""

# Ensure directories exist
echo "📁 Ensuring critical directories exist..."
python3 ensure_directories.py
if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize directories!"
    exit 1
fi

echo ""
echo "✅ Post-deployment setup complete!"
echo ""
echo "Next steps:"
echo "1. Update dependencies: pip install -r requirements.txt"
echo "2. Restart your application (systemctl, docker, etc.)"
