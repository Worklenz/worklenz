#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${RED}Stopping Worklenz Docker Environment...${NC}"

# Check which Docker Compose command to use
if command -v docker compose &> /dev/null; then
    # Docker Compose V2
    docker compose down
else
    # Legacy Docker Compose
    docker-compose down
fi

echo -e "${GREEN}Worklenz services have been stopped.${NC}" 