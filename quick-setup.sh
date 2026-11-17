#!/bin/bash

# ============================================================================
# Worklenz Quick Setup Script
# ============================================================================
# This script automates the setup process:
# 1. Checks for .env file
# 2. Auto-generates all secrets
# 3. Configures URLs based on DOMAIN variable
# 4. Uses a self-signed localhost certificate or an externally provisioned domain certificate
# 5. Installs and starts Worklenz
# ============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_header() {
    clear
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
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           ${BLUE}Worklenz Quick Setup - Automated Installation${CYAN}              ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to generate secure random string
generate_secret() {
    openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64
}

update_env_value() {
    local key="$1"
    local value="$2"

    if grep -q "^${key}=" "$env_file"; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$env_file"
    else
        printf '%s=%s\n' "$key" "$value" >> "$env_file"
    fi
}

# Function to auto-generate all secrets in .env file
auto_generate_secrets() {
    local env_file="$1"

    print_info "Auto-generating security secrets..."

    # Generate secrets
    local db_password=$(generate_secret)
    local session_secret=$(generate_secret)
    local cookie_secret=$(generate_secret)
    local jwt_secret=$(generate_secret)
    local seaweedfs_secret=$(generate_secret)
    local redis_password=$(generate_secret)

    # Update .env file with generated secrets
    sed -i.bak "s|^DB_PASSWORD=.*|DB_PASSWORD=${db_password}|" "$env_file"
    sed -i.bak "s|^SESSION_SECRET=.*|SESSION_SECRET=${session_secret}|" "$env_file"
    sed -i.bak "s|^COOKIE_SECRET=.*|COOKIE_SECRET=${cookie_secret}|" "$env_file"
    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" "$env_file"
    update_env_value "S3_SECRET_ACCESS_KEY" "$seaweedfs_secret"

    # Add Redis password if not present
    if ! grep -q "^REDIS_PASSWORD=" "$env_file"; then
        echo "REDIS_PASSWORD=${redis_password}" >> "$env_file"
    else
        sed -i.bak "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${redis_password}|" "$env_file"
    fi

    # Set the SeaweedFS S3 access key
    update_env_value "S3_ACCESS_KEY_ID" "worklenz"

    rm -f "$env_file.bak"

    print_success "All security secrets generated automatically"
    echo ""
    print_info "Generated credentials:"
    echo "  • Database Password: ${db_password:0:16}..."
    echo "  • Session Secret: ${session_secret:0:16}..."
    echo "  • Cookie Secret: ${cookie_secret:0:16}..."
    echo "  • JWT Secret: ${jwt_secret:0:16}..."
    echo "  • SeaweedFS Secret: ${seaweedfs_secret:0:16}..."
    echo "  • Redis Password: ${redis_password:0:16}..."
    echo ""
    print_warning "These secrets are saved in .env file - keep it secure!"
}

print_header

echo -e "${BLUE}This script will:${NC}"
echo "  1. Create .env file if it doesn't exist"
echo "  2. Auto-generate all security secrets"
echo "  3. Configure URLs based on your domain"
echo "  4. Set up SSL certificates"
echo "  5. Install and start Worklenz"
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    print_warning ".env file not found"

    # Check if .env.example exists
    if [ -f "$ENV_EXAMPLE" ]; then
        print_info "Creating .env from .env.example..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        print_success ".env file created"
        echo ""

        # Auto-generate secrets for new .env file
        auto_generate_secrets "$ENV_FILE"
    else
        print_error ".env.example not found!"
        print_info "Please ensure .env.example exists in $SCRIPT_DIR"
        exit 1
    fi
else
    print_success ".env file found"
    echo ""

    # Check if secrets need to be generated (check for placeholder values)
    if grep -q "CHANGE_THIS" "$ENV_FILE"; then
        print_warning "Found placeholder secrets in .env file"
        read -p "Do you want to auto-generate new secure secrets? (Y/n): " generate_secrets
        generate_secrets=${generate_secrets:-Y}

        if [[ "$generate_secrets" =~ ^[Yy]$ ]]; then
            echo ""
            auto_generate_secrets "$ENV_FILE"
        else
            print_warning "Skipping secret generation - make sure to update secrets manually!"
            echo ""
        fi
    else
        print_info "Secrets appear to be configured"
        echo ""
    fi
fi

# Call the manage.sh script to complete the installation
echo ""
echo -e "${YELLOW}Starting Automated Installation${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "$SCRIPT_DIR/manage.sh" ]; then
    chmod +x "$SCRIPT_DIR/manage.sh"

    print_info "Running installation with manage.sh..."
    echo ""

    # Run manage.sh install option (option 1)
    "$SCRIPT_DIR/manage.sh" install

else
    print_error "manage.sh not found!"
    print_info "Please ensure manage.sh exists in $SCRIPT_DIR"
    exit 1
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    ${GREEN}Installation Complete!${CYAN}                             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# The installer may have changed the domain while it was running.
domain=$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | tail -n 1)
domain=${domain:-localhost}
if [[ "$domain" == "localhost" || "$domain" == "127.0.0.1" || "$domain" == "0.0.0.0" ]]; then
    echo -e "  ${GREEN}Access Worklenz at:${NC} ${BLUE}https://localhost${NC}"
    echo ""
    echo -e "  ${YELLOW}Note:${NC} You'll see a browser warning about the self-signed certificate."
    echo "  This is normal for localhost. Click 'Advanced' and 'Proceed' to access."
else
    echo -e "  ${GREEN}Access Worklenz at:${NC} ${BLUE}https://$domain${NC}"
    echo ""
    echo -e "  ${YELLOW}Important:${NC} Ensure your domain's DNS A record points to this server's IP."
fi

echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  - Manage services: ./manage.sh"
echo "  - View logs: ./manage.sh (option 6)"
echo "  - Create backup: ./manage.sh (option 7)"
echo ""
