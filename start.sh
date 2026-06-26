#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${GREEN}"
echo " __          __        _    _"                
echo " \ \        / /       | |  | |"               
echo "  \ \  /\  / /__  _ __| | _| | ___ _ __  ____"
echo "   \ \/  \/ / _ \| '__| |/ / |/ _ \ '_ \|_  /"
echo "    \  /\  / (_) | |  |   <| |  __/ | | |/ /" 
echo "     \/  \/ \___/|_|  |_|\_\_|\___|_| |_/___|"
echo ""
echo "         W O R K L E N Z                     "
echo -e "${NC}"
echo "Starting Worklenz Docker Environment..."

# Check if update-docker-env.sh exists and is executable
if [ -f update-docker-env.sh ] && [ -x update-docker-env.sh ]; then
    echo -e "${BLUE}Found update-docker-env.sh script. You can use it to update environment variables.${NC}"
fi

# Function to check if a service is running
check_service() {
  local service_name=$1
  local container_name=$2
  local url=$3
  local max_attempts=30
  local attempt=1

  echo -e "${BLUE}Checking ${service_name} service...${NC}"
  
  # First check if the container is running
  while [ $attempt -le $max_attempts ]; do
    if docker ps | grep -q "${container_name}"; then
      # Container is running
      if [ -z "$url" ]; then
        # No URL to check, assume service is up
        echo -e "${GREEN}✓${NC} ${service_name} is running"
        return 0
      else
        # Check if service endpoint is responding
        if curl -s -f -o /dev/null "$url"; then
          echo -e "${GREEN}✓${NC} ${service_name} is running and responding at ${url}"
          return 0
        else
          if [ $attempt -eq $max_attempts ]; then
            echo -e "${YELLOW}⚠${NC} ${service_name} container is running but not responding at ${url}"
            return 1
          fi
        fi
      fi
    else
      if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}✗${NC} ${service_name} failed to start"
        return 1
      fi
    fi
    
    echo -n "."
    attempt=$((attempt+1))
    sleep 1
  done
  
  return 1
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker daemon is running
echo -e "${BLUE}Running preflight checks...${NC}"
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker is running"

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

# Check if any of the ports are already in use
ports=(3000 5000 9000 9001 5432)
for port in "${ports[@]}"; do
    if lsof -i:"$port" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Warning: Port $port is already in use. This may cause conflicts.${NC}"
    fi
done

# Start the containers
echo -e "${BLUE}Starting Worklenz services...${NC}"
$DOCKER_COMPOSE_CMD down
$DOCKER_COMPOSE_CMD up -d

# Wait for services to fully initialize
echo -e "${BLUE}Waiting for services to initialize...${NC}"
echo "This may take a minute or two depending on your system..."

# Check each service
check_service "Database" "worklenz_db" ""
DB_STATUS=$?

check_service "MinIO" "worklenz_minio" "http://localhost:9000/minio/health/live"
MINIO_STATUS=$?

check_service "Backend" "worklenz_backend" "http://localhost:3000/public/health"
BACKEND_STATUS=$?

check_service "Frontend" "worklenz_frontend" "http://localhost:5000"
FRONTEND_STATUS=$?

# Display service URLs
echo -e "\n${BLUE}Service URLs:${NC}"
[ $FRONTEND_STATUS -eq 0 ] && echo "  • Frontend: http://localhost:5000 (or https://localhost:5000 if SSL is enabled)"
[ $BACKEND_STATUS -eq 0 ] && echo "  • Backend API: http://localhost:3000 (or https://localhost:3000 if SSL is enabled)"
[ $MINIO_STATUS -eq 0 ] && echo "  • MinIO Console: http://localhost:9001 (login: minioadmin/minioadmin)"

# Check if all services are up
if [ $DB_STATUS -eq 0 ] && [ $MINIO_STATUS -eq 0 ] && [ $BACKEND_STATUS -eq 0 ] && [ $FRONTEND_STATUS -eq 0 ]; then
    echo -e "\n${GREEN}✅ All Worklenz services are running successfully!${NC}"
else
    echo -e "\n${YELLOW}⚠ Some services may not be running properly. Check the logs for more details:${NC}"
    echo "  $DOCKER_COMPOSE_CMD logs"
fi

echo -e "\n${BLUE}Useful commands:${NC}"
echo "  • View logs: $DOCKER_COMPOSE_CMD logs -f"
echo "  • Stop services: ./stop.sh"
echo "  • Update environment variables: ./update-docker-env.sh"
echo -e "\n${YELLOW}Note:${NC} To enable SSL, set ENABLE_SSL=true in your .env file and run ./update-docker-env.sh" 