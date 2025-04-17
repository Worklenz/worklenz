#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print banner
echo -e "${GREEN}"
echo " __          __        _    _"                
echo "  \ \        / /       | |  | |"               
echo "  \ \  /\  / /__  _ __| | _| | ___ _ __  ____"
echo "   \ \/  \/ / _ \| '__| |/ / |/ _ \ '_ \|_  /"
echo "    \  /\  / (_) | |  |   <| |  __/ | | |/ /" 
echo "     \/  \/ \___/|_|  |_|\_\_|\___|_| |_/___|"
echo ""
echo "         W O R K L E N Z                     "
echo -e "${NC}"
echo "Starting Worklenz Docker Environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Using default configuration.${NC}"
    # Copy the example .env file if it exists
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Created .env file from .env.example"
    fi
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo "Warning: Docker Compose V2 not found, trying docker-compose command..."
    if ! command -v docker-compose &> /dev/null; then
        echo "Error: Docker Compose is not installed or not in PATH"
        echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    # Use docker-compose command instead
    docker-compose down
    docker-compose up -d
else
    # Use Docker Compose V2
    docker compose down
    docker compose up -d
fi

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 5

# Check if services are running
if docker ps | grep -q "worklenz_frontend"; then
    echo -e "${GREEN}✓${NC} Frontend is running"
    FRONTEND_URL="http://localhost:5000"
    echo "   Frontend URL: $FRONTEND_URL"
else
    echo "✗ Frontend service failed to start"
fi

if docker ps | grep -q "worklenz_backend"; then
    echo -e "${GREEN}✓${NC} Backend is running"
    BACKEND_URL="http://localhost:3000"
    echo "   Backend URL: $BACKEND_URL"
else
    echo "✗ Backend service failed to start"
fi

if docker ps | grep -q "worklenz_minio"; then
    echo -e "${GREEN}✓${NC} MinIO is running"
    MINIO_URL="http://localhost:9001"
    echo "   MinIO Console URL: $MINIO_URL (login: minioadmin/minioadmin)"
else
    echo "✗ MinIO service failed to start"
fi

if docker ps | grep -q "worklenz_db"; then
    echo -e "${GREEN}✓${NC} Database is running"
else
    echo "✗ Database service failed to start"
fi

echo -e "\n${GREEN}Worklenz is now running!${NC}"
echo "You can access the application at: http://localhost:5000"
echo "To stop the services, run: docker compose down" 