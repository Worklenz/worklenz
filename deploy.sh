#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting deployment process...${NC}"

# Function to handle errors
handle_error() {
    echo -e "${RED}Error occurred during deployment!${NC}"
    echo -e "${RED}Keeping maintenance mode active for safety.${NC}"
    echo -e "${YELLOW}Please check the error and run deployment again.${NC}"
    exit 1
}

# Function to disable maintenance mode on script exit
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    sudo rm -f /var/www/maintenance-mode
    sudo nginx -s reload
    echo -e "${GREEN}Maintenance mode disabled${NC}"
}

# Set trap to cleanup on script exit (success or failure)
trap cleanup EXIT

# 1. Enable maintenance mode
echo -e "${YELLOW}Enabling maintenance mode...${NC}"
sudo touch /var/www/maintenance-mode
sudo nginx -s reload
echo -e "${RED}🔧 Site is now in maintenance mode${NC}"

# 2. Pull latest changes
echo -e "${YELLOW}Pulling latest changes...${NC}"
git pull || handle_error

# 3. Build frontend
echo -e "${YELLOW}Building frontend application...${NC}"
cd worklenz-frontend

# Install dependencies
npm i || handle_error

# Build the application
npm run build || handle_error

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend build successful!${NC}"
else
    echo -e "${RED}❌ Frontend build failed!${NC}"
    handle_error
fi

# 4. Return to root directory
cd ..

# 5. Build backend and restart with PM2
echo -e "${YELLOW}Building backend application and restarting service...${NC}"
cd worklenz-backend

# Install backend dependencies
npm i || handle_error

# Build backend
npm run build || handle_error

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend build successful!${NC}"
else
    echo -e "${RED}❌ Backend build failed!${NC}"
    handle_error
fi

# Restart PM2 service
echo -e "${YELLOW}Restarting PM2 service...${NC}"
pm2 restart 4 --update-env || handle_error

# Wait a moment for the service to fully restart
sleep 3

# Check if PM2 service is running
if pm2 describe 4 | grep -q "online"; then
    echo -e "${GREEN}✅ Backend service restarted successfully!${NC}"
else
    echo -e "${RED}❌ Backend service failed to restart!${NC}"
    handle_error
fi

# 6. Disable maintenance mode (handled by cleanup function)
echo -e "${GREEN}🚀 Deployment completed successfully!${NC}"
echo -e "${GREEN}Site is now live with latest changes${NC}"

# Optional: Show deployment summary
echo -e "${BLUE}=== Deployment Summary ===${NC}"
echo -e "${GREEN}✅ Git pull completed${NC}"
echo -e "${GREEN}✅ Frontend built and deployed${NC}"
echo -e "${GREEN}✅ Backend built and restarted${NC}"
echo -e "${GREEN}✅ Maintenance mode disabled${NC}"
echo -e "${BLUE}=========================${NC}"
