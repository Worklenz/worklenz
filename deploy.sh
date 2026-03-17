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

# Defaults (override via env vars on the server if needed)
PM2_APP_ID=${PM2_APP_ID:-4}

# Parse command-line arguments
DEPLOY_FRONTEND=false
DEPLOY_CLIENT_PORTAL=false
DEPLOY_BACKEND=false
DEPLOY_ALL=false
SKIP_GIT_PULL=false

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --all                Deploy all components (default if no options specified)"
    echo "  --frontend           Deploy frontend only"
    echo "  --client-portal      Deploy client portal only"
    echo "  --backend            Deploy backend only"
    echo "  --skip-git           Skip git pull (useful for local testing)"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                          # Deploy all components"
    echo "  $0 --all                    # Deploy all components"
    echo "  $0 --frontend               # Deploy frontend only"
    echo "  $0 --frontend --backend     # Deploy frontend and backend"
    echo "  $0 --backend --skip-git     # Deploy backend without git pull"
    echo ""
    exit 0
}

# Parse arguments
if [ $# -eq 0 ]; then
    DEPLOY_ALL=true
else
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                DEPLOY_ALL=true
                shift
                ;;
            --frontend)
                DEPLOY_FRONTEND=true
                shift
                ;;
            --client-portal)
                DEPLOY_CLIENT_PORTAL=true
                shift
                ;;
            --backend)
                DEPLOY_BACKEND=true
                shift
                ;;
            --skip-git)
                SKIP_GIT_PULL=true
                shift
                ;;
            -h|--help)
                show_usage
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
fi

# If --all is specified, enable all deployments
if [ "$DEPLOY_ALL" = true ]; then
    DEPLOY_FRONTEND=true
    DEPLOY_CLIENT_PORTAL=true
    DEPLOY_BACKEND=true
fi

# Display deployment plan
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Starting Worklenz Deployment Process${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Deployment Plan:${NC}"
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo -e "  ${GREEN}✓${NC} Frontend"
else
    echo -e "  ${YELLOW}⊘${NC} Frontend (skipped)"
fi
if [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
    echo -e "  ${GREEN}✓${NC} Client Portal"
else
    echo -e "  ${YELLOW}⊘${NC} Client Portal (skipped)"
fi
if [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "  ${GREEN}✓${NC} Backend"
else
    echo -e "  ${YELLOW}⊘${NC} Backend (skipped)"
fi
if [ "$SKIP_GIT_PULL" = true ]; then
    echo -e "  ${YELLOW}⊘${NC} Git pull (skipped)"
fi
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
        if [ "${MAINTENANCE_ENABLED:-false}" = true ]; then
            echo -e "${YELLOW}Disabling maintenance mode...${NC}"
            sudo rm -f /var/www/maintenance-mode
            sudo nginx -s reload
            echo -e "${GREEN}✅ Maintenance mode disabled${NC}"
        fi
    fi
}

# Set trap to cleanup only on successful exit
trap cleanup EXIT

MAINTENANCE_ENABLED=false

# Temp files for passing build artifact paths from parallel build jobs
DEPLOY_TMP_DIR="$(mktemp -d -t worklenz-deploy-XXXXXX)"
FRONTEND_BUILD_PATH_FILE="$DEPLOY_TMP_DIR/frontend-build-path"
CLIENT_PORTAL_BUILD_PATH_FILE="$DEPLOY_TMP_DIR/client-portal-build-path"

# 1. Pull latest changes
if [ "$SKIP_GIT_PULL" = false ]; then
    echo -e "${YELLOW}▶ Pulling latest changes from git...${NC}"
    git pull
    if [ $? -ne 0 ]; then
        handle_error "Git pull" $?
    fi
    echo -e "${GREEN}✅ Git pull completed${NC}"
    echo ""
else
    echo -e "${YELLOW}⊘ Skipping git pull${NC}"
    echo ""
fi

# 2. Build Frontend and Client Portal in PARALLEL (build first; swap later)
if [ "$DEPLOY_FRONTEND" = true ] || [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
    if [ "$DEPLOY_FRONTEND" = true ] && [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
        echo -e "${YELLOW}▶ Building Frontend and Client Portal (parallel)...${NC}"
    elif [ "$DEPLOY_FRONTEND" = true ]; then
        echo -e "${YELLOW}▶ Building Frontend...${NC}"
    else
        echo -e "${YELLOW}▶ Building Client Portal...${NC}"
    fi
fi

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

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo "$ROOT_DIR/worklenz-frontend/$temp_build" > "$FRONTEND_BUILD_PATH_FILE"
    echo -e "${GREEN}[Frontend]${NC} ✅ Build completed in ${duration}s (ready to swap)"
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

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo "$ROOT_DIR/worklenz-client-portal/$temp_build" > "$CLIENT_PORTAL_BUILD_PATH_FILE"
    echo -e "${GREEN}[Client Portal]${NC} ✅ Build completed in ${duration}s (ready to swap)"
    return 0
}

# Run builds in parallel or sequentially based on selection
if [ "$DEPLOY_FRONTEND" = true ] || [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
    PARALLEL_START=$(date +%s)
    FRONTEND_EXIT=0
    CLIENT_PORTAL_EXIT=0
    FRONTEND_PID=""
    CLIENT_PORTAL_PID=""

    # Start builds
    if [ "$DEPLOY_FRONTEND" = true ]; then
        build_frontend &
        FRONTEND_PID=$!
    fi

    if [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
        build_client_portal &
        CLIENT_PORTAL_PID=$!
    fi

    # Wait for builds to complete
    if [ -n "$FRONTEND_PID" ]; then
        wait $FRONTEND_PID
        FRONTEND_EXIT=$?
    fi

    if [ -n "$CLIENT_PORTAL_PID" ]; then
        wait $CLIENT_PORTAL_PID
        CLIENT_PORTAL_EXIT=$?
    fi

    PARALLEL_END=$(date +%s)
    PARALLEL_DURATION=$((PARALLEL_END - PARALLEL_START))

    # Check if builds succeeded
    if [ "$DEPLOY_FRONTEND" = true ] && [ $FRONTEND_EXIT -ne 0 ]; then
        handle_error "Frontend build" $FRONTEND_EXIT
    fi

    if [ "$DEPLOY_CLIENT_PORTAL" = true ] && [ $CLIENT_PORTAL_EXIT -ne 0 ]; then
        handle_error "Client Portal build" $CLIENT_PORTAL_EXIT
    fi

    # Success message
    if [ "$DEPLOY_FRONTEND" = true ] && [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
        echo -e "${GREEN}✅ Frontend and Client Portal built successfully in ${PARALLEL_DURATION}s${NC}"
    elif [ "$DEPLOY_FRONTEND" = true ]; then
        echo -e "${GREEN}✅ Frontend built successfully in ${PARALLEL_DURATION}s${NC}"
    else
        echo -e "${GREEN}✅ Client Portal built successfully in ${PARALLEL_DURATION}s${NC}"
    fi
    echo ""
fi

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
if [ "$DEPLOY_BACKEND" = true ]; then
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
else
    BACKEND_DURATION=0
fi

# 6. Restart Backend with PM2
if [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "${YELLOW}▶ Restarting Backend service with PM2...${NC}"
    pm2 restart "$PM2_APP_ID" --update-env > /dev/null 2>&1
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
        if pm2 describe "$PM2_APP_ID" 2>&1 | grep -q "online"; then
            echo -e "${GREEN}✅ Backend service is running${NC}"
            break
        fi

        HEALTH_CHECK_ATTEMPTS=$((HEALTH_CHECK_ATTEMPTS + 1))
        if [ $HEALTH_CHECK_ATTEMPTS -lt $MAX_HEALTH_CHECKS ]; then
            echo -e "${YELLOW}Waiting for service to come online (attempt ${HEALTH_CHECK_ATTEMPTS}/${MAX_HEALTH_CHECKS})...${NC}"
            sleep 2
        else
            echo -e "${RED}Health check failed - service not responding${NC}"
            pm2 logs "$PM2_APP_ID" --lines 20
            handle_error "Health check" 1
        fi
    done

    echo ""
fi

# 7. Brief maintenance mode and atomic swap (frontend/client portal)
if [ "$DEPLOY_FRONTEND" = true ] || [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
    echo -e "${YELLOW}▶ Enabling maintenance mode (brief) for final swap...${NC}"
    sudo touch /var/www/maintenance-mode
    sudo nginx -s reload
    if [ $? -ne 0 ]; then
        handle_error "Enable maintenance mode" $?
    fi
    MAINTENANCE_ENABLED=true
    echo ""

    if [ "$DEPLOY_FRONTEND" = true ]; then
        if [ ! -f "$FRONTEND_BUILD_PATH_FILE" ]; then
            handle_error "Frontend build artifact missing" 1
        fi
        FRONTEND_BUILD_PATH="$(cat "$FRONTEND_BUILD_PATH_FILE")"
        if [ ! -d "$FRONTEND_BUILD_PATH" ]; then
            handle_error "Frontend build artifact not found" 1
        fi

        echo -e "${YELLOW}▶ Swapping Frontend build...${NC}"
        cd "$ROOT_DIR/worklenz-frontend" || handle_error "Frontend directory not found" 1

        if [ -d "build" ] && [ ! -L "build" ]; then
            mv build "build-backup-$(date +%s)" 2>/dev/null || true
        elif [ -L "build" ]; then
            rm -f build
        fi

        mv "$FRONTEND_BUILD_PATH" build
        ls -t | grep "^build-backup-" | tail -n +3 | xargs -r rm -rf
        echo -e "${GREEN}✅ Frontend deployed${NC}"
        echo ""
    fi

    if [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
        if [ ! -f "$CLIENT_PORTAL_BUILD_PATH_FILE" ]; then
            handle_error "Client Portal build artifact missing" 1
        fi
        CLIENT_PORTAL_BUILD_PATH="$(cat "$CLIENT_PORTAL_BUILD_PATH_FILE")"
        if [ ! -d "$CLIENT_PORTAL_BUILD_PATH" ]; then
            handle_error "Client Portal build artifact not found" 1
        fi

        echo -e "${YELLOW}▶ Swapping Client Portal build...${NC}"
        cd "$ROOT_DIR/worklenz-client-portal" || handle_error "Client Portal directory not found" 1

        if [ -d "dist" ] && [ ! -L "dist" ]; then
            mv dist "dist-backup-$(date +%s)" 2>/dev/null || true
        elif [ -L "dist" ]; then
            rm -f dist
        fi

        mv "$CLIENT_PORTAL_BUILD_PATH" dist
        ls -t | grep "^dist-backup-" | tail -n +3 | xargs -r rm -rf
        echo -e "${GREEN}✅ Client Portal deployed${NC}"
        echo ""
    fi

    echo -e "${YELLOW}Disabling maintenance mode...${NC}"
    sudo rm -f /var/www/maintenance-mode
    sudo nginx -s reload
    if [ $? -ne 0 ]; then
        handle_error "Disable maintenance mode" $?
    fi
    MAINTENANCE_ENABLED=false
    echo -e "${GREEN}✅ Maintenance mode disabled${NC}"
    echo ""
fi

rm -rf "$DEPLOY_TMP_DIR" 2>/dev/null || true

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
if [ "$DEPLOY_FRONTEND" = true ] || [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
    if [ "$DEPLOY_FRONTEND" = true ] && [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
        echo -e "  Frontend + Client Portal: ${PARALLEL_DURATION}s (parallel)"
    elif [ "$DEPLOY_FRONTEND" = true ]; then
        echo -e "  Frontend: ${PARALLEL_DURATION}s"
    else
        echo -e "  Client Portal: ${PARALLEL_DURATION}s"
    fi
fi
if [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "  Backend: ${BACKEND_DURATION}s"
fi
echo -e "  Total deployment: ${MINUTES}m ${SECONDS}s"
echo ""
if [ "$SKIP_GIT_PULL" = false ]; then
    echo -e "${GREEN}✅ Git pull completed${NC}"
fi
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo -e "${GREEN}✅ Frontend built and deployed${NC}"
fi
if [ "$DEPLOY_CLIENT_PORTAL" = true ]; then
    echo -e "${GREEN}✅ Client Portal built and deployed${NC}"
fi
if [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "${GREEN}✅ Backend built and restarted${NC}"
    echo -e "${GREEN}✅ Health check passed${NC}"
fi
echo -e "${GREEN}════════════════════════════════════════${NC}"
