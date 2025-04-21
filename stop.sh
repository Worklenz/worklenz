#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${RED}"
echo " __          __        _    _"                
echo " \ \        / /       | |  | |"               
echo "  \ \  /\  / /__  _ __| | _| | ___ _ __  ____"
echo "   \ \/  \/ / _ \| '__| |/ / |/ _ \ '_ \|_  /"
echo "    \  /\  / (_) | |  |   <| |  __/ | | |/ /" 
echo "     \/  \/ \___/|_|  |_|\_\_|\___|_| |_/___|"
echo ""
echo "         W O R K L E N Z                     "
echo -e "${NC}"
echo -e "${BLUE}Stopping Worklenz Docker Environment...${NC}"

# Determine Docker Compose command to use
DOCKER_COMPOSE_CMD=""
if command -v docker compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
    echo -e "${GREEN}✓${NC} Using Docker Compose V2"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
    echo -e "${YELLOW}⚠${NC} Using legacy Docker Compose"
else
    echo -e "${RED}Error: Docker Compose is not installed or not in PATH${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Stop the containers
echo -e "${BLUE}Stopping all services...${NC}"
$DOCKER_COMPOSE_CMD down

# Check if containers are still running
if docker ps | grep -q "worklenz_"; then
    echo -e "${YELLOW}⚠ Some Worklenz containers are still running. Forcing stop...${NC}"
    docker stop $(docker ps -q --filter "name=worklenz_")
    echo -e "${GREEN}✓${NC} Forced stop completed."
else
    echo -e "${GREEN}✓${NC} All Worklenz services have been stopped successfully."
fi

echo -e "\n${BLUE}To start Worklenz again, run:${NC} ./start.sh" 