#!/bin/bash
# Git Deployment Script for Hostinger VPS
# Run this on your SERVER via SSH

echo "=== Crypto Portfolio Deployment ==="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Installing..."
    # For Hostinger/Ubuntu
    sudo apt-get update && sudo apt-get install -y git
fi

# Set your deployment directory (usually public_html)
DEPLOY_DIR="/home/username/domains/yourdomain.com/public_html"
# Or if you know the path, update it above

echo "Deployment directory: $DEPLOY_DIR"
read -p "Is this correct? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    read -p "Enter correct path: " DEPLOY_DIR
fi

# Navigate to deployment directory
cd $DEPLOY_DIR || exit

# Clone or pull from git
if [ -d ".git" ]; then
    echo "Git repository exists. Pulling latest changes..."
    git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/Matej398/crypto_folio.git .
fi

# Create config.php from server config
if [ ! -f "api/config.php" ]; then
    echo "Creating config.php..."
    cp api/config.server.php api/config.php
    echo "✅ config.php created"
else
    echo "⚠️  config.php already exists. Please update it manually with server credentials."
fi

# Set permissions
chmod 644 api/config.php
chmod 755 api/
chmod 644 api/*.php

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Verify api/config.php has correct database credentials"
echo "2. Test: https://yourdomain.com/api/auth.php?action=check"
echo "3. Visit: https://yourdomain.com"

