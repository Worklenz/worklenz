#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Deployment start time
DEPLOY_START=$(date +%s)

# Store current directory
ROOT_DIR=$(pwd)

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Starting Worklenz Deployment Process${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Function to handle errors
handle_error() {
    local component=$1
    local exit_code=$2
    echo ""
    echo -e "${RED}═══ ERROR ═══${NC}"
    echo -e "${RED}Error in: ${component}${NC}"
    echo -e "${RED}Exit code: ${exit_code}${NC}"
    echo -e "${RED}Keeping maintenance mode active for safety${NC}"
    echo -e "${RED}═════════════${NC}"

    # Don't cleanup - keep maintenance mode active
    trap - EXIT
    exit 1
}

# Function to disable maintenance mode on successful exit only
cleanup() {
    if [ $? -eq 0 ]; then
        echo -e "${YELLOW}Disabling maintenance mode...${NC}"
        sudo rm -f /var/www/maintenance-mode
        sudo nginx -s reload
        echo -e "${GREEN}✅ Maintenance mode disabled${NC}"
    fi
}

# Set trap to cleanup only on successful exit
trap cleanup EXIT

# 1. Enable maintenance mode
echo -e "${YELLOW}▶ Enabling maintenance mode...${NC}"
sudo touch /var/www/maintenance-mode
sudo nginx -s reload
echo -e "${RED}🔧 Site is now in maintenance mode${NC}"
echo ""

# 2. Pull latest changes
echo -e "${YELLOW}▶ Pulling latest changes from git...${NC}"
git pull
if [ $? -ne 0 ]; then
    handle_error "Git pull" $?
fi
echo -e "${GREEN}✅ Git pull completed${NC}"
echo ""

# 3. Build Frontend and Client Portal in PARALLEL
echo -e "${YELLOW}▶ Building Frontend and Client Portal (parallel)...${NC}"

# Frontend build function
build_frontend() {
    local start_time=$(date +%s)
    cd "$ROOT_DIR/worklenz-frontend" || return 1

    echo -e "${BLUE}[Frontend]${NC} Installing dependencies..."
    npm ci --prefer-offline --no-audit --progress=false > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[Frontend]${NC} npm ci failed"
        return 1
    fi

    # Create temporary build directory with timestamp
    local temp_build="build-$(date +%s)"
    echo -e "${BLUE}[Frontend]${NC} Building to temporary directory: ${temp_build}..."
    
    # Build to temporary directory
    VITE_BUILD_OUTDIR="$temp_build" NODE_OPTIONS="--max-old-space-size=4096" npm run build > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[Frontend]${NC} Build failed"
        rm -rf "$temp_build"
        return 1
    fi

    # Atomic swap: rename current build to backup, move new build to production
    if [ -d "build" ] && [ ! -L "build" ]; then
        echo -e "${BLUE}[Frontend]${NC} Backing up current build..."
        mv build "build-backup-$(date +%s)" 2>/dev/null || true
    elif [ -L "build" ]; then
        # If build is a symlink, remove it
        rm -f build
    fi
    
    # Move new build to production location
    mv "$temp_build" build
    
    # Clean up old backups (keep last 2)
    echo -e "${BLUE}[Frontend]${NC} Cleaning up old builds..."
    ls -t | grep "^build-backup-" | tail -n +3 | xargs -r rm -rf

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "${GREEN}[Frontend]${NC} ✅ Build completed and deployed atomically in ${duration}s"
    return 0
}

# Client Portal build function
build_client_portal() {
    local start_time=$(date +%s)
    cd "$ROOT_DIR/worklenz-client-portal" || return 1

    echo -e "${BLUE}[Client Portal]${NC} Installing dependencies..."
    npm ci --prefer-offline --no-audit --progress=false > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[Client Portal]${NC} npm ci failed"
        return 1
    fi

    # Create temporary build directory with timestamp
    local temp_build="dist-$(date +%s)"
    echo -e "${BLUE}[Client Portal]${NC} Building to temporary directory: ${temp_build}..."
    
    # Build to temporary directory
    VITE_BUILD_OUTDIR="$temp_build" npm run build > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[Client Portal]${NC} Build failed"
        rm -rf "$temp_build"
        return 1
    fi

    # Atomic swap: rename current dist to backup, move new build to production
    if [ -d "dist" ] && [ ! -L "dist" ]; then
        echo -e "${BLUE}[Client Portal]${NC} Backing up current build..."
        mv dist "dist-backup-$(date +%s)" 2>/dev/null || true
    elif [ -L "dist" ]; then
        # If dist is a symlink, remove it
        rm -f dist
    fi
    
    # Move new build to production location
    mv "$temp_build" dist
    
    # Clean up old backups (keep last 2)
    echo -e "${BLUE}[Client Portal]${NC} Cleaning up old builds..."
    ls -t | grep "^dist-backup-" | tail -n +3 | xargs -r rm -rf

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "${GREEN}[Client Portal]${NC} ✅ Build completed and deployed atomically in ${duration}s"
    return 0
}

# Run builds in parallel
PARALLEL_START=$(date +%s)
build_frontend &
FRONTEND_PID=$!

build_client_portal &
CLIENT_PORTAL_PID=$!

# Wait for both builds to complete
FRONTEND_EXIT=0
CLIENT_PORTAL_EXIT=0

wait $FRONTEND_PID
FRONTEND_EXIT=$?

wait $CLIENT_PORTAL_PID
CLIENT_PORTAL_EXIT=$?

PARALLEL_END=$(date +%s)
PARALLEL_DURATION=$((PARALLEL_END - PARALLEL_START))

# Check if both builds succeeded
if [ $FRONTEND_EXIT -ne 0 ]; then
    handle_error "Frontend build" $FRONTEND_EXIT
fi

if [ $CLIENT_PORTAL_EXIT -ne 0 ]; then
    handle_error "Client Portal build" $CLIENT_PORTAL_EXIT
fi

echo -e "${GREEN}✅ Frontend and Client Portal built successfully in ${PARALLEL_DURATION}s${NC}"
echo ""

# 4. Verify Apple Sign-In key file (if Apple login is enabled)
if [ -n "$APPLE_PRIVATE_KEY_PATH" ] || grep -q "APPLE_CLIENT_ID" "$ROOT_DIR/worklenz-backend/.env" 2>/dev/null; then
    echo -e "${YELLOW}▶ Checking Apple Sign-In key file...${NC}"
    KEY_PATH=$(grep "APPLE_PRIVATE_KEY_PATH" "$ROOT_DIR/worklenz-backend/.env" 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    if [ -n "$KEY_PATH" ]; then
        # Resolve relative path
        if [[ "$KEY_PATH" == ./* ]]; then
            FULL_KEY_PATH="$ROOT_DIR/worklenz-backend/${KEY_PATH#./}"
        else
            FULL_KEY_PATH="$KEY_PATH"
        fi
        if [ -f "$FULL_KEY_PATH" ]; then
            echo -e "${GREEN}✅ Apple Sign-In key file found${NC}"
        else
            echo -e "${RED}⚠️  WARNING: Apple Sign-In key file not found at: $FULL_KEY_PATH${NC}"
            echo -e "${YELLOW}   Apple Sign-In will not work until the key file is uploaded.${NC}"
            echo -e "${YELLOW}   See docs/APPLE_P8_KEY_MANAGEMENT.md for instructions.${NC}"
        fi
    fi
    echo ""
fi

# 5. Build Backend
echo -e "${YELLOW}▶ Building Backend application...${NC}"
BACKEND_START=$(date +%s)

cd "$ROOT_DIR/worklenz-backend" || handle_error "Backend directory not found" 1

echo -e "${BLUE}[Backend]${NC} Installing dependencies..."
npm ci --prefer-offline --no-audit --progress=false > /dev/null 2>&1
if [ $? -ne 0 ]; then
    handle_error "Backend npm ci" $?
fi

echo -e "${BLUE}[Backend]${NC} Building application..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    handle_error "Backend build" $?
fi

BACKEND_END=$(date +%s)
BACKEND_DURATION=$((BACKEND_END - BACKEND_START))
echo -e "${GREEN}✅ Backend built successfully in ${BACKEND_DURATION}s${NC}"
echo ""

# 6. Restart Backend with PM2
echo -e "${YELLOW}▶ Restarting Backend service with PM2...${NC}"
pm2 restart 4 --update-env > /dev/null 2>&1
if [ $? -ne 0 ]; then
    handle_error "PM2 restart" $?
fi

# Wait for service to stabilize
sleep 5

# 7. Health Check
echo -e "${YELLOW}▶ Performing health check...${NC}"
HEALTH_CHECK_ATTEMPTS=0
MAX_HEALTH_CHECKS=10

while [ $HEALTH_CHECK_ATTEMPTS -lt $MAX_HEALTH_CHECKS ]; do
    if pm2 describe 4 2>&1 | grep -q "online"; then
        echo -e "${GREEN}✅ Backend service is running${NC}"
        break
    fi

    HEALTH_CHECK_ATTEMPTS=$((HEALTH_CHECK_ATTEMPTS + 1))
    if [ $HEALTH_CHECK_ATTEMPTS -lt $MAX_HEALTH_CHECKS ]; then
        echo -e "${YELLOW}Waiting for service to come online (attempt ${HEALTH_CHECK_ATTEMPTS}/${MAX_HEALTH_CHECKS})...${NC}"
        sleep 2
    else
        echo -e "${RED}Health check failed - service not responding${NC}"
        pm2 logs 4 --lines 20
        handle_error "Health check" 1
    fi
done

echo ""

# Calculate total deployment time
DEPLOY_END=$(date +%s)
TOTAL_DURATION=$((DEPLOY_END - DEPLOY_START))
MINUTES=$((TOTAL_DURATION / 60))
SECONDS=$((TOTAL_DURATION % 60))

# Return to root directory
cd "$ROOT_DIR"

# Success summary
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}🚀 Deployment Completed Successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📊 Build Time Summary:${NC}"
echo -e "  Frontend + Client Portal: ${PARALLEL_DURATION}s (parallel)"
echo -e "  Backend: ${BACKEND_DURATION}s"
echo -e "  Total deployment: ${MINUTES}m ${SECONDS}s"
echo ""
echo -e "${GREEN}✅ Git pull completed${NC}"
echo -e "${GREEN}✅ Frontend built and deployed${NC}"
echo -e "${GREEN}✅ Client Portal built and deployed${NC}"
echo -e "${GREEN}✅ Backend built and restarted${NC}"
echo -e "${GREEN}✅ Health check passed${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
