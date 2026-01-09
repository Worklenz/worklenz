#!/bin/bash

# ============================================================================
# Worklenz Quick Setup Script
# ============================================================================
# This script automates the setup process:
# 1. Checks for .env file
# 2. Auto-generates all secrets
# 3. Configures URLs based on DOMAIN variable
# 4. Sets up SSL (self-signed for localhost, Let's Encrypt for production)
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

# Function to auto-generate all secrets in .env file
auto_generate_secrets() {
    local env_file="$1"

    print_info "Auto-generating security secrets..."

    # Generate secrets
    local db_password=$(generate_secret)
    local session_secret=$(generate_secret)
    local cookie_secret=$(generate_secret)
    local jwt_secret=$(generate_secret)
    local minio_password=$(generate_secret)
    local redis_password=$(generate_secret)

    # Update .env file with generated secrets
    sed -i.bak "s|^DB_PASSWORD=.*|DB_PASSWORD=${db_password}|" "$env_file"
    sed -i.bak "s|^SESSION_SECRET=.*|SESSION_SECRET=${session_secret}|" "$env_file"
    sed -i.bak "s|^COOKIE_SECRET=.*|COOKIE_SECRET=${cookie_secret}|" "$env_file"
    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" "$env_file"
    sed -i.bak "s|^AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=${minio_password}|" "$env_file"

    # Add Redis password if not present
    if ! grep -q "^REDIS_PASSWORD=" "$env_file"; then
        echo "REDIS_PASSWORD=${redis_password}" >> "$env_file"
    else
        sed -i.bak "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${redis_password}|" "$env_file"
    fi

    # Update MinIO root password to match
    sed -i.bak "s|^AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=minioadmin|" "$env_file"

    rm -f "$env_file.bak"

    print_success "All security secrets generated automatically"
    echo ""
    print_info "Generated credentials:"
    echo "  • Database Password: ${db_password:0:16}..."
    echo "  • Session Secret: ${session_secret:0:16}..."
    echo "  • Cookie Secret: ${cookie_secret:0:16}..."
    echo "  • JWT Secret: ${jwt_secret:0:16}..."
    echo "  • MinIO Password: ${minio_password:0:16}..."
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

# Ask for domain
echo ""
echo -e "${YELLOW}Domain Configuration${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Enter your domain name:"
echo "  - Recommended for local testing: enter 'localhost'"
echo "  - For production: enter your domain (e.g., worklenz.example.com)"
echo ""
read -p "Domain [localhost]: " domain
domain=${domain:-localhost}
echo ""

# Update DOMAIN in .env
sed -i.bak "s/^DOMAIN=.*/DOMAIN=$domain/" "$ENV_FILE"
rm -f "$ENV_FILE.bak"

print_success "Domain set to: $domain"

# Ask if user wants to build and push Docker images
echo ""
echo -e "${YELLOW}Docker Image Build (Optional)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Do you want to build and push custom Docker images?"
echo "  - Answer 'no' (Recommended): Use official pre-built images from Docker Hub"
echo "  - Answer 'yes': Build your own images and push to your Docker Hub account"
echo ""
read -p "Build custom images? (y/N): " build_images

if [[ "$build_images" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Enter your Docker Hub username (used to tag and push your custom images):"
    read -p "Docker Hub username: " docker_username

    if [ -n "$docker_username" ]; then
        # Save to .env
        sed -i.bak "s/^DOCKER_USERNAME=.*/DOCKER_USERNAME=$docker_username/" "$ENV_FILE"
        rm -f "$ENV_FILE.bak"

        # Update docker-compose.yaml with the new Docker Hub username
        print_info "Updating docker-compose.yaml with Docker Hub username..."
        if [ -f "$SCRIPT_DIR/docker-compose.yaml" ]; then
            sed -i.bak "s|image: .*/worklenz-backend:latest|image: $docker_username/worklenz-backend:latest|" "$SCRIPT_DIR/docker-compose.yaml"
            sed -i.bak "s|image: .*/worklenz-frontend:latest|image: $docker_username/worklenz-frontend:latest|" "$SCRIPT_DIR/docker-compose.yaml"
            rm -f "$SCRIPT_DIR/docker-compose.yaml.bak"
        fi

        print_success "Docker Hub username saved: $docker_username"
        print_success "docker-compose.yaml updated with your username"
        BUILD_IMAGES=true
    else
        print_warning "No username provided, skipping image build"
        BUILD_IMAGES=false
    fi
else
    BUILD_IMAGES=false

    # Ask if user wants to update Docker Hub username anyway (for pulling pre-built images)
    echo ""
    echo "Do you want to use a custom Docker Hub username for pulling images?"
    echo "  - Answer 'yes' to use your own pre-built images"
    echo "  - Answer 'no' to use default images (chamikajaycey/worklenz-*)"
    echo ""
    read -p "Use custom Docker Hub username? (y/N): " use_custom_username

    if [[ "$use_custom_username" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Enter your Docker Hub username:"
        read -p "Docker Hub username: " docker_username

        if [ -n "$docker_username" ]; then
            # Update docker-compose.yaml with the new Docker Hub username
            print_info "Updating docker-compose.yaml with Docker Hub username..."
            if [ -f "$SCRIPT_DIR/docker-compose.yaml" ]; then
                sed -i.bak "s|image: .*/worklenz-backend:latest|image: $docker_username/worklenz-backend:latest|" "$SCRIPT_DIR/docker-compose.yaml"
                sed -i.bak "s|image: .*/worklenz-frontend:latest|image: $docker_username/worklenz-frontend:latest|" "$SCRIPT_DIR/docker-compose.yaml"
                rm -f "$SCRIPT_DIR/docker-compose.yaml.bak"

                print_success "docker-compose.yaml updated to use: $docker_username"
            fi
        fi
    fi
fi

# If production domain, ask for Let's Encrypt email
if [[ "$domain" != "localhost" && "$domain" != "127.0.0.1" && "$domain" != "0.0.0.0" ]]; then
    echo ""
    echo -e "${YELLOW}SSL Certificate Setup${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "For Let's Encrypt SSL certificates, we need an email address."
    echo "This email will be used for:"
    echo "  - Certificate expiration notifications"
    echo "  - Important account updates"
    echo ""
    read -p "Enter email for Let's Encrypt: " letsencrypt_email

    if [ -n "$letsencrypt_email" ]; then
        # Uncomment and set LETSENCRYPT_EMAIL
        sed -i.bak "s/^# LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$letsencrypt_email/" "$ENV_FILE"
        sed -i.bak "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$letsencrypt_email/" "$ENV_FILE"
        rm -f "$ENV_FILE.bak"
        print_success "Let's Encrypt email configured"
    fi
fi

# Build and push images if requested
if [ "$BUILD_IMAGES" = true ]; then
    echo ""
    echo -e "${YELLOW}Building and Pushing Docker Images${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ -f "$SCRIPT_DIR/manage.sh" ]; then
        chmod +x "$SCRIPT_DIR/manage.sh"
        "$SCRIPT_DIR/manage.sh" build

        if [ $? -ne 0 ]; then
            print_error "Image build failed!"
            exit 1
        fi
    else
        print_error "manage.sh not found!"
        exit 1
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

if [[ "$domain" == "localhost" ]]; then
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
