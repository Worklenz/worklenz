#!/bin/bash

# ============================================================================
# Worklenz Local Management Script
# ============================================================================
# This script provides an interactive menu for managing local Worklenz deployment
# Supports both localhost (self-signed SSL) and production domains (Let's Encrypt)
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
DOCKER_COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yaml"
SSL_DIR="$SCRIPT_DIR/nginx/ssl"
BACKUP_DIR="$SCRIPT_DIR/backups"
REPO_DIR="$SCRIPT_DIR"

# ============================================================================
# Helper Functions
# ============================================================================

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
    echo -e "${CYAN}║           ${BLUE}Worklenz Self-Hosted Management Console${CYAN}                    ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

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

# Load environment variables
load_env() {
    if [ -f "$ENV_FILE" ]; then
        set -a
        source "$ENV_FILE"
        set +a
    fi
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        print_info "Install Docker: https://docs.docker.com/get-docker/"
        return 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
        print_error "Docker Compose is not installed!"
        print_info "Install Docker Compose: https://docs.docker.com/compose/install/"
        return 1
    fi
    return 0
}

# Get docker compose command
get_compose_cmd() {
    if docker compose version &> /dev/null 2>&1; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# Detect if running on localhost or production domain
is_localhost() {
    local domain="${DOMAIN:-localhost}"
    if [[ "$domain" == "localhost" || "$domain" == "127.0.0.1" || "$domain" == "0.0.0.0" ]]; then
        return 0
    fi
    return 1
}

# Generate secure random string
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
    fi
}

# ============================================================================
# SSL Certificate Functions
# ============================================================================

setup_self_signed_ssl() {
    print_info "Setting up self-signed SSL certificates for localhost..."

    mkdir -p "$SSL_DIR"

    if command -v openssl &> /dev/null; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$SSL_DIR/key.pem" \
            -out "$SSL_DIR/cert.pem" \
            -subj "/C=US/ST=State/L=City/O=Worklenz/CN=localhost" \
            &> /dev/null

        chmod 644 "$SSL_DIR/cert.pem"
        chmod 600 "$SSL_DIR/key.pem"

        print_success "Self-signed SSL certificates generated"
    else
        # Use Docker with alpine/openssl if openssl not available
        docker run --rm -v "$SSL_DIR:/certs" alpine/openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /certs/key.pem \
            -out /certs/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Worklenz/CN=localhost" \
            2>/dev/null

        chmod 644 "$SSL_DIR/cert.pem"
        chmod 600 "$SSL_DIR/key.pem"

        print_success "Self-signed SSL certificates generated (using Docker)"
    fi
}

setup_letsencrypt_ssl() {
    local domain="${DOMAIN}"
    local email="${LETSENCRYPT_EMAIL}"
    local compose_cmd=$(get_compose_cmd)

    if [ -z "$email" ]; then
        print_error "LETSENCRYPT_EMAIL not set in .env file!"
        echo ""
        read -p "Enter email for Let's Encrypt notifications: " email
        if [ -z "$email" ]; then
            print_error "Email is required for Let's Encrypt"
            return 1
        fi
        
        # Update .env file
        if grep -q "^LETSENCRYPT_EMAIL=" "$ENV_FILE"; then
            sed -i.bak "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$email/" "$ENV_FILE"
        else
            echo "LETSENCRYPT_EMAIL=$email" >> "$ENV_FILE"
        fi
        load_env
    fi

    print_info "Setting up Let's Encrypt SSL for $domain..."
    echo ""
    print_warning "Before continuing, ensure:"
    echo "  ✓ DNS A record for $domain points to this server IP"
    echo "  ✓ Port 80 and 443 are accessible from the internet"
    echo "  ✓ No firewall blocking HTTP/HTTPS traffic"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "SSL setup cancelled"
        return 1
    fi

    # Start nginx for ACME challenge
    print_info "Starting nginx for domain verification..."
    $compose_cmd up -d nginx
    sleep 5

    # Request certificate
    print_info "Requesting SSL certificate from Let's Encrypt..."
    print_info "This may take 1-2 minutes..."
    echo ""

    $compose_cmd run --rm certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        -d "$domain" \
        2>&1 | tee /tmp/certbot.log

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        # Update nginx config to use Let's Encrypt certificates
        print_info "Updating nginx configuration..."
        
        cp "$SCRIPT_DIR/nginx/conf.d/worklenz.conf" "$SCRIPT_DIR/nginx/conf.d/worklenz.conf.bak"
        
        sed -i.tmp \
            -e "s|ssl_certificate /etc/nginx/ssl/cert.pem;|ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;|" \
            -e "s|ssl_certificate_key /etc/nginx/ssl/key.pem;|ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;|" \
            "$SCRIPT_DIR/nginx/conf.d/worklenz.conf"
        
        rm -f "$SCRIPT_DIR/nginx/conf.d/worklenz.conf.tmp"

        # Update .env to enable SSL
        sed -i.bak 's/^ENABLE_SSL=.*/ENABLE_SSL=true/' "$ENV_FILE"
        
        print_success "Let's Encrypt SSL certificates obtained successfully!"
        print_info "Backup saved: nginx/conf.d/worklenz.conf.bak"
        return 0
    else
        print_error "Failed to obtain Let's Encrypt certificate"
        echo ""
        print_info "Common issues:"
        echo "  • DNS not configured properly (test with: dig $domain)"
        echo "  • Port 80 blocked by firewall"
        echo "  • Domain not pointing to this server"
        echo "  • Another service using port 80"
        echo ""
        print_info "Check logs: cat /tmp/certbot.log"
        return 1
    fi
}

auto_setup_ssl() {
    if is_localhost; then
        print_info "Detected localhost deployment - using self-signed SSL"
        setup_self_signed_ssl
        sed -i.bak 's/^ENABLE_SSL=.*/ENABLE_SSL=false/' "$ENV_FILE"
    else
        print_info "Detected domain deployment: ${DOMAIN}"
        print_info "Setting up Let's Encrypt SSL..."
        setup_letsencrypt_ssl
    fi
}

# ============================================================================
# Service Management Functions
# ============================================================================

start_services() {
    print_header
    echo -e "${BLUE}Starting Worklenz Docker Environment...${NC}"
    echo ""

    # Check if .env exists, if not create from .env.example
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "${ENV_FILE}.example" ]; then
            print_info "Creating .env from .env.example..."
            cp "${ENV_FILE}.example" "$ENV_FILE"
            print_success ".env file created"
            echo ""
        else
            print_error ".env file not found and .env.example not found!"
            print_info "Please create .env file from .env.example"
            return 1
        fi
    fi

    load_env
    local compose_cmd=$(get_compose_cmd)
    local deployment_mode="${DEPLOYMENT_MODE:-express}"
    local compose_profiles="--profile $deployment_mode"

    # Add SSL profile if enabled
    if [[ "${ENABLE_SSL:-false}" == "true" ]]; then
        compose_profiles="$compose_profiles --profile ssl"
    fi

    print_info "Deployment mode: $deployment_mode"
    if is_localhost; then
        print_info "SSL mode: Self-signed (localhost)"
    else
        print_info "SSL mode: Let's Encrypt (${DOMAIN})"
    fi
    echo ""

    print_info "Starting containers..."
    $compose_cmd $compose_profiles up -d

    echo ""
    print_info "Waiting for services to be ready..."
    sleep 10

    # Show service status
    echo ""
    $compose_cmd ps
    echo ""

    print_success "Worklenz started!"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}Access Worklenz at:${NC} ${VITE_API_URL:-https://localhost}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if is_localhost; then
        echo ""
        print_warning "Using self-signed SSL - browser will show security warning"
        print_info "Click 'Advanced' → 'Proceed to localhost' to continue"
    fi
}

stop_services() {
    print_header
    echo -e "${BLUE}Stopping Worklenz Services${NC}"
    echo ""

    local compose_cmd=$(get_compose_cmd)
    $compose_cmd --profile express --profile advanced --profile ssl --profile backup down

    print_success "Services stopped"
}

restart_services() {
    stop_services
    echo ""
    read -p "Press Enter to start services..."
    start_services
}

view_logs() {
    print_header
    echo -e "${BLUE}Service Logs${NC}"
    echo ""
    echo "1. All services"
    echo "2. Backend"
    echo "3. Frontend"
    echo "4. PostgreSQL"
    echo "5. Nginx"
    echo "6. MinIO"
    echo "7. Redis"
    echo "8. Certbot"
    echo "0. Back"
    echo ""

    read -p "Enter choice [0-8]: " log_choice
    local compose_cmd=$(get_compose_cmd)

    case $log_choice in
        1) $compose_cmd logs -f --tail=100 ;;
        2) $compose_cmd logs -f --tail=100 backend ;;
        3) $compose_cmd logs -f --tail=100 frontend ;;
        4) $compose_cmd logs -f --tail=100 postgres ;;
        5) $compose_cmd logs -f --tail=100 nginx ;;
        6) $compose_cmd logs -f --tail=100 minio ;;
        7) $compose_cmd logs -f --tail=100 redis ;;
        8) $compose_cmd logs -f --tail=100 certbot ;;
        0) return ;;
        *) print_error "Invalid choice" ;;
    esac
}

service_status() {
    print_header
    echo -e "${BLUE}Service Status${NC}"
    echo ""

    local compose_cmd=$(get_compose_cmd)
    $compose_cmd ps

    echo ""
    print_info "Detailed health status:"
    echo ""

    # Check each service
    docker ps --filter "name=worklenz-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "worklenz-|NAMES"
}

# ============================================================================
# Backup and Restore Functions
# ============================================================================

backup_data() {
    print_header
    echo -e "${BLUE}Backup Worklenz Data${NC}"
    echo ""

    load_env
    mkdir -p "$BACKUP_DIR"

    local compose_cmd=$(get_compose_cmd)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$BACKUP_DIR/backup_$timestamp"
    
    mkdir -p "$backup_dir"

    print_info "Creating comprehensive backup..."
    echo ""

    # Backup database
    print_info "[1/4] Backing up PostgreSQL database..."
    $compose_cmd exec -T postgres pg_dump -U "${DB_USER:-postgres}" "${DB_NAME:-worklenz_db}" > "$backup_dir/database.sql"
    print_success "Database backed up"

    # Backup Redis data
    if [[ "${DEPLOYMENT_MODE:-express}" == "express" ]]; then
        print_info "[2/4] Backing up Redis data..."
        $compose_cmd exec -T redis redis-cli --raw SAVE > /dev/null 2>&1 || true
        docker run --rm -v worklenz_redis_data:/data -v "$backup_dir:/backup" alpine tar czf "/backup/redis_data.tar.gz" -C /data . 2>/dev/null
        print_success "Redis data backed up"

        # Backup MinIO data
        print_info "[3/4] Backing up MinIO storage..."
        docker run --rm -v worklenz_minio_data:/data -v "$backup_dir:/backup" alpine tar czf "/backup/minio_data.tar.gz" -C /data . 2>/dev/null
        print_success "MinIO storage backed up"
    else
        print_info "[2/4] Skipping Redis backup (advanced mode)"
        print_info "[3/4] Skipping MinIO backup (advanced mode)"
    fi

    # Backup configuration
    print_info "[4/4] Backing up configuration..."
    cp "$ENV_FILE" "$backup_dir/env_backup"
    cp -r "$SCRIPT_DIR/nginx" "$backup_dir/nginx_backup" 2>/dev/null || true
    print_success "Configuration backed up"

    # Create archive
    print_info "Creating backup archive..."
    tar -czf "$BACKUP_DIR/worklenz_backup_$timestamp.tar.gz" -C "$BACKUP_DIR" "backup_$timestamp"
    rm -rf "$backup_dir"

    local backup_file="$BACKUP_DIR/worklenz_backup_$timestamp.tar.gz"
    local backup_size=$(du -h "$backup_file" | cut -f1)

    echo ""
    print_success "Backup completed successfully!"
    print_info "Backup file: $backup_file"
    print_info "Backup size: $backup_size"

    # Cleanup old backups
    local retention_days="${BACKUP_RETENTION_DAYS:-30}"
    print_info "Cleaning backups older than $retention_days days..."
    find "$BACKUP_DIR" -name "worklenz_backup_*.tar.gz" -mtime +$retention_days -delete
}

restore_data() {
    print_header
    echo -e "${BLUE}Restore Worklenz Data${NC}"
    echo ""

    # List available backups
    print_info "Available backups:"
    echo ""
    
    local backups=($(ls -t "$BACKUP_DIR"/worklenz_backup_*.tar.gz 2>/dev/null))

    if [ ${#backups[@]} -eq 0 ]; then
        print_error "No backups found in $BACKUP_DIR"
        return 1
    fi

    local i=1
    for backup in "${backups[@]}"; do
        local size=$(du -h "$backup" | cut -f1)
        local filename=$(basename "$backup")
        local date_str=$(echo "$filename" | sed 's/worklenz_backup_\(.*\)\.tar\.gz/\1/' | sed 's/_/ /; s/_/:/')
        echo "$i. $date_str ($size)"
        i=$((i + 1))
    done
    echo "0. Cancel"
    echo ""

    read -p "Select backup to restore [1-${#backups[@]}]: " backup_choice

    if [[ "$backup_choice" == "0" || -z "$backup_choice" ]]; then
        print_info "Restore cancelled"
        return 0
    fi

    if [ "$backup_choice" -lt 1 ] || [ "$backup_choice" -gt ${#backups[@]} ]; then
        print_error "Invalid selection"
        return 1
    fi

    local selected_backup="${backups[$((backup_choice - 1))]}"

    echo ""
    print_warning "⚠️  WARNING: This will REPLACE current data!"
    print_warning "⚠️  Current database, Redis, and MinIO data will be LOST!"
    echo ""
    read -p "Type 'yes' to confirm restore: " confirm

    if [[ "$confirm" != "yes" ]]; then
        print_info "Restore cancelled"
        return 0
    fi

    load_env
    local compose_cmd=$(get_compose_cmd)
    local temp_dir=$(mktemp -d)

    # Extract backup
    print_info "Extracting backup..."
    tar -xzf "$selected_backup" -C "$temp_dir"
    local backup_content=$(ls "$temp_dir")

    # Stop services
    print_info "Stopping services..."
    $compose_cmd down

    # Restore database
    print_info "Restoring database..."
    $compose_cmd up -d postgres
    sleep 10

    if [ -f "$temp_dir/$backup_content/database.sql" ]; then
        $compose_cmd exec -T postgres psql -U "${DB_USER:-postgres}" -d "${DB_NAME:-worklenz_db}" < "$temp_dir/$backup_content/database.sql" 2>/dev/null
        print_success "Database restored"
    fi

    # Restore Redis
    if [ -f "$temp_dir/$backup_content/redis_data.tar.gz" ]; then
        print_info "Restoring Redis data..."
        docker run --rm -v worklenz_redis_data:/data -v "$temp_dir/$backup_content:/backup" alpine sh -c "rm -rf /data/* && tar xzf /backup/redis_data.tar.gz -C /data"
        print_success "Redis data restored"
    fi

    # Restore MinIO
    if [ -f "$temp_dir/$backup_content/minio_data.tar.gz" ]; then
        print_info "Restoring MinIO storage..."
        docker run --rm -v worklenz_minio_data:/data -v "$temp_dir/$backup_content:/backup" alpine sh -c "rm -rf /data/* && tar xzf /backup/minio_data.tar.gz -C /data"
        print_success "MinIO storage restored"
    fi

    # Restore configuration
    if [ -f "$temp_dir/$backup_content/env_backup" ]; then
        echo ""
        read -p "Restore .env configuration? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp "$temp_dir/$backup_content/env_backup" "$ENV_FILE"
            print_success "Configuration restored"
        fi
    fi

    # Cleanup
    rm -rf "$temp_dir"

    # Restart services
    print_info "Restarting services..."
    start_services

    echo ""
    print_success "Restore completed successfully!"
}

# ============================================================================
# Configuration Functions
# ============================================================================

# Check if a value is a placeholder
is_placeholder() {
    local value="$1"
    if [[ "$value" =~ ^CHANGE_THIS || "$value" == "dummy" || -z "$value" ]]; then
        return 0
    fi
    return 1
}

# Auto-configure environment based on DOMAIN variable
auto_configure_env() {
    if [ ! -f "$ENV_FILE" ]; then
        print_error ".env file not found!"
        return 1
    fi

    load_env
    local domain="${DOMAIN:-localhost}"
    local needs_update=0

    print_info "Auto-configuring environment for domain: $domain"

    # Check and generate secrets if needed
    if is_placeholder "$SESSION_SECRET"; then
        print_info "Generating SESSION_SECRET..."
        local session_secret=$(generate_secret)
        sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$session_secret/" "$ENV_FILE"
        needs_update=1
    fi

    if is_placeholder "$COOKIE_SECRET"; then
        print_info "Generating COOKIE_SECRET..."
        local cookie_secret=$(generate_secret)
        sed -i.bak "s/^COOKIE_SECRET=.*/COOKIE_SECRET=$cookie_secret/" "$ENV_FILE"
        needs_update=1
    fi

    if is_placeholder "$JWT_SECRET"; then
        print_info "Generating JWT_SECRET..."
        local jwt_secret=$(generate_secret)
        sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" "$ENV_FILE"
        needs_update=1
    fi

    if is_placeholder "$DB_PASSWORD"; then
        print_info "Generating DB_PASSWORD..."
        local db_password=$(generate_secret | cut -c1-32)
        sed -i.bak "s/^DB_PASSWORD=.*/DB_PASSWORD=$db_password/" "$ENV_FILE"
        needs_update=1
    fi

    if is_placeholder "$AWS_SECRET_ACCESS_KEY"; then
        print_info "Generating AWS_SECRET_ACCESS_KEY (MinIO password)..."
        local minio_password=$(generate_secret | cut -c1-32)
        sed -i.bak "s/^AWS_SECRET_ACCESS_KEY=.*/AWS_SECRET_ACCESS_KEY=$minio_password/" "$ENV_FILE"
        needs_update=1
    fi

    # Update Redis password if it's still default
    if [[ "$REDIS_PASSWORD" == "worklenz_redis_pass" ]]; then
        print_info "Generating secure REDIS_PASSWORD..."
        local redis_password=$(generate_secret | cut -c1-32)
        sed -i.bak "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$redis_password/" "$ENV_FILE"
        needs_update=1
    fi

    # Update URLs based on domain
    if [[ "$domain" == "localhost" ]]; then
        print_info "Configuring URLs for localhost..."
        sed -i.bak "s|^VITE_API_URL=.*|VITE_API_URL=https://localhost|" "$ENV_FILE"
        sed -i.bak "s|^VITE_SOCKET_URL=.*|VITE_SOCKET_URL=wss://localhost|" "$ENV_FILE"
        sed -i.bak "s|^FRONTEND_URL=.*|FRONTEND_URL=https://localhost|" "$ENV_FILE"
        sed -i.bak "s|^SERVER_CORS=.*|SERVER_CORS=https://localhost|" "$ENV_FILE"
        sed -i.bak "s|^SOCKET_IO_CORS=.*|SOCKET_IO_CORS=https://localhost|" "$ENV_FILE"
        sed -i.bak "s|^GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=https://localhost/auth/google/callback|" "$ENV_FILE"
        needs_update=1
    else
        print_info "Configuring URLs for production domain: $domain..."
        sed -i.bak "s|^VITE_API_URL=.*|VITE_API_URL=https://$domain|" "$ENV_FILE"
        sed -i.bak "s|^VITE_SOCKET_URL=.*|VITE_SOCKET_URL=wss://$domain|" "$ENV_FILE"
        sed -i.bak "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$domain|" "$ENV_FILE"
        sed -i.bak "s|^SERVER_CORS=.*|SERVER_CORS=https://$domain|" "$ENV_FILE"
        sed -i.bak "s|^SOCKET_IO_CORS=.*|SOCKET_IO_CORS=https://$domain|" "$ENV_FILE"
        sed -i.bak "s|^GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=https://$domain/auth/google/callback|" "$ENV_FILE"
        needs_update=1
    fi

    rm -f "$ENV_FILE.bak"

    if [ $needs_update -eq 1 ]; then
        print_success "Environment auto-configured successfully!"
        echo ""
        print_info "Generated secure secrets for:"
        echo "  - SESSION_SECRET"
        echo "  - COOKIE_SECRET"
        echo "  - JWT_SECRET"
        echo "  - DB_PASSWORD"
        echo "  - AWS_SECRET_ACCESS_KEY (MinIO)"
        echo "  - REDIS_PASSWORD"
        echo ""
        print_info "Configured URLs for domain: $domain"
    else
        print_success "Environment already configured"
    fi
}

# Interactive configuration
configure_env() {
    print_header
    echo -e "${BLUE}Environment Configuration${NC}"
    echo ""

    if [ -f "$ENV_FILE" ]; then
        print_warning ".env file already exists"
        read -p "Reconfigure? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
    fi

    # Domain configuration
    echo ""
    read -p "Enter domain (or 'localhost' for local testing) [localhost]: " domain
    domain=${domain:-localhost}

    # Generate secrets
    print_info "Generating secure secrets..."
    local session_secret=$(generate_secret)
    local cookie_secret=$(generate_secret)
    local jwt_secret=$(generate_secret)

    # Passwords
    echo ""
    read -sp "Enter PostgreSQL password (or press Enter to generate): " db_password
    echo
    if [ -z "$db_password" ]; then
        db_password=$(generate_secret | cut -c1-32)
    fi

    read -sp "Enter MinIO password (or press Enter to generate): " minio_password
    echo
    if [ -z "$minio_password" ]; then
        minio_password=$(generate_secret | cut -c1-32)
    fi

    read -sp "Enter Redis password (or press Enter to generate): " redis_password
    echo
    if [ -z "$redis_password" ]; then
        redis_password=$(generate_secret | cut -c1-32)
    fi

    # Update .env file
    sed -i.bak "s/^DOMAIN=.*/DOMAIN=$domain/" "$ENV_FILE"
    sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$session_secret/" "$ENV_FILE"
    sed -i.bak "s/^COOKIE_SECRET=.*/COOKIE_SECRET=$cookie_secret/" "$ENV_FILE"
    sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" "$ENV_FILE"
    sed -i.bak "s/^DB_PASSWORD=.*/DB_PASSWORD=$db_password/" "$ENV_FILE"
    sed -i.bak "s/^AWS_SECRET_ACCESS_KEY=.*/AWS_SECRET_ACCESS_KEY=$minio_password/" "$ENV_FILE"
    sed -i.bak "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$redis_password/" "$ENV_FILE"

    # Update URLs based on domain
    if [[ "$domain" == "localhost" ]]; then
        sed -i.bak "s|^VITE_API_URL=.*|VITE_API_URL=https://localhost|" "$ENV_FILE"
        sed -i.bak "s|^VITE_SOCKET_URL=.*|VITE_SOCKET_URL=wss://localhost|" "$ENV_FILE"
        sed -i.bak "s|^FRONTEND_URL=.*|FRONTEND_URL=https://localhost|" "$ENV_FILE"
        sed -i.bak "s|^SERVER_CORS=.*|SERVER_CORS=https://localhost|" "$ENV_FILE"
        sed -i.bak "s|^SOCKET_IO_CORS=.*|SOCKET_IO_CORS=https://localhost|" "$ENV_FILE"
    else
        sed -i.bak "s|^VITE_API_URL=.*|VITE_API_URL=https://$domain|" "$ENV_FILE"
        sed -i.bak "s|^VITE_SOCKET_URL=.*|VITE_SOCKET_URL=wss://$domain|" "$ENV_FILE"
        sed -i.bak "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$domain|" "$ENV_FILE"
        sed -i.bak "s|^SERVER_CORS=.*|SERVER_CORS=https://$domain|" "$ENV_FILE"
        sed -i.bak "s|^SOCKET_IO_CORS=.*|SOCKET_IO_CORS=https://$domain|" "$ENV_FILE"

        # Ask for Let's Encrypt email
        echo ""
        read -p "Enter email for Let's Encrypt: " letsencrypt_email
        sed -i.bak "s/^# LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$letsencrypt_email/" "$ENV_FILE"
        sed -i.bak "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$letsencrypt_email/" "$ENV_FILE"
    fi

    rm -f "$ENV_FILE.bak"

    echo ""
    print_success "Configuration completed!"
    print_info "Configuration saved to .env"
}

# ============================================================================
# Docker Image Build and Push Functions
# ============================================================================

# Build images only (no push)
build_images() {
    print_header
    echo -e "${BLUE}Build Docker Images${NC}"
    echo ""

    # Check prerequisites
    if ! check_docker; then
        return 1
    fi

    # Check if .env exists, if not create from .env.example
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "${ENV_FILE}.example" ]; then
            print_info "Creating .env from .env.example..."
            cp "${ENV_FILE}.example" "$ENV_FILE"
            print_success ".env file created"
        else
            print_error ".env file not found and .env.example not found!"
            print_info "Please create .env file from .env.example"
            return 1
        fi
    fi

    load_env

    # Ask for Docker Hub username
    local docker_username="${DOCKER_USERNAME:-}"
    if [ -z "$docker_username" ]; then
        echo ""
        read -p "Enter Docker Hub username: " docker_username
        if [ -z "$docker_username" ]; then
            print_error "Docker Hub username is required!"
            return 1
        fi
        # Save to .env
        sed -i.bak "s/^DOCKER_USERNAME=.*/DOCKER_USERNAME=$docker_username/" "$ENV_FILE"
        rm -f "$ENV_FILE.bak"
    fi

    # Get version numbers from environment or prompt
    local backend_version="${BACKEND_VERSION:-}"
    local frontend_version="${FRONTEND_VERSION:-}"

    echo ""
    echo -e "${YELLOW}Version Configuration${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ -z "$backend_version" ]; then
        read -p "Enter backend version (e.g., 2.1.5) [latest]: " backend_version
        backend_version=${backend_version:-latest}
    fi

    if [ -z "$frontend_version" ]; then
        read -p "Enter frontend version (e.g., 2.1.5) [latest]: " frontend_version
        frontend_version=${frontend_version:-latest}
    fi

    echo ""
    print_info "Docker Hub Username: $docker_username"
    print_info "Backend Version: $backend_version"
    print_info "Frontend Version: $frontend_version"
    echo ""

    # Build backend image
    print_info "Building backend image..."
    echo ""

    if [ "$backend_version" == "latest" ]; then
        # Build only with latest tag
        docker build \
            -f "$SCRIPT_DIR/worklenz-backend/Dockerfile" \
            -t "${docker_username}/worklenz-backend:latest" \
            "$SCRIPT_DIR/worklenz-backend"
    else
        # Build with both version tag and latest tag
        docker build \
            -f "$SCRIPT_DIR/worklenz-backend/Dockerfile" \
            -t "${docker_username}/worklenz-backend:${backend_version}" \
            -t "${docker_username}/worklenz-backend:latest" \
            "$SCRIPT_DIR/worklenz-backend"
    fi

    if [ $? -ne 0 ]; then
        print_error "Backend build failed!"
        return 1
    fi

    print_success "Backend image built successfully!"
    if [ "$backend_version" != "latest" ]; then
        print_info "Tagged as: ${docker_username}/worklenz-backend:${backend_version}"
        print_info "Tagged as: ${docker_username}/worklenz-backend:latest"
    else
        print_info "Tagged as: ${docker_username}/worklenz-backend:latest"
    fi
    echo ""

    # Build frontend image
    print_info "Building frontend image..."
    echo ""

    if [ "$frontend_version" == "latest" ]; then
        # Build only with latest tag
        docker build \
            -f "$SCRIPT_DIR/worklenz-frontend/Dockerfile" \
            -t "${docker_username}/worklenz-frontend:latest" \
            "$SCRIPT_DIR/worklenz-frontend"
    else
        # Build with both version tag and latest tag
        docker build \
            -f "$SCRIPT_DIR/worklenz-frontend/Dockerfile" \
            -t "${docker_username}/worklenz-frontend:${frontend_version}" \
            -t "${docker_username}/worklenz-frontend:latest" \
            "$SCRIPT_DIR/worklenz-frontend"
    fi

    if [ $? -ne 0 ]; then
        print_error "Frontend build failed!"
        return 1
    fi

    print_success "Frontend image built successfully!"
    if [ "$frontend_version" != "latest" ]; then
        print_info "Tagged as: ${docker_username}/worklenz-frontend:${frontend_version}"
        print_info "Tagged as: ${docker_username}/worklenz-frontend:latest"
    else
        print_info "Tagged as: ${docker_username}/worklenz-frontend:latest"
    fi
    echo ""

    # Update docker-compose.yaml to use the new images
    print_info "Updating docker-compose.yaml..."

    # Update backend image in docker-compose.yaml to match built version
    sed -i.bak "s|image: .*/worklenz-backend:\${BACKEND_VERSION:-.*}|image: ${docker_username}/worklenz-backend:\${BACKEND_VERSION:-${backend_version}}|" "$DOCKER_COMPOSE_FILE"

    # Update frontend image in docker-compose.yaml to match built version
    sed -i.bak "s|image: .*/worklenz-frontend:\${FRONTEND_VERSION:-.*}|image: ${docker_username}/worklenz-frontend:\${FRONTEND_VERSION:-${frontend_version}}|" "$DOCKER_COMPOSE_FILE"

    rm -f "$DOCKER_COMPOSE_FILE.bak"

    echo ""
    print_success "Images built successfully!"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if [ "$backend_version" != "latest" ]; then
        echo -e "  ${GREEN}Backend Images:${NC}"
        echo -e "    - ${docker_username}/worklenz-backend:${backend_version}"
        echo -e "    - ${docker_username}/worklenz-backend:latest"
        echo -e "  ${GREEN}Frontend Images:${NC}"
        echo -e "    - ${docker_username}/worklenz-frontend:${frontend_version}"
        echo -e "    - ${docker_username}/worklenz-frontend:latest"
    else
        echo -e "  ${GREEN}Backend Image:${NC} ${docker_username}/worklenz-backend:latest"
        echo -e "  ${GREEN}Frontend Image:${NC} ${docker_username}/worklenz-frontend:latest"
    fi
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Ask if user wants to push to Docker Hub
    echo ""
    read -p "Do you want to push images to Docker Hub? (y/N): " push_choice

    if [[ "$push_choice" =~ ^[Yy]$ ]]; then
        echo ""
        print_info "Pushing images to Docker Hub..."

        # Login to Docker Hub
        print_info "Please login to Docker Hub..."
        docker login

        if [ $? -ne 0 ]; then
            print_error "Docker login failed!"
            print_info "You can push images later using: ./manage.sh push"
            return 1
        fi

        # Push backend images
        print_info "Pushing backend images..."
        if [ "$backend_version" != "latest" ]; then
            docker push "${docker_username}/worklenz-backend:${backend_version}"
            if [ $? -ne 0 ]; then
                print_error "Backend image push failed!"
                return 1
            fi
        fi
        docker push "${docker_username}/worklenz-backend:latest"
        if [ $? -ne 0 ]; then
            print_error "Backend latest image push failed!"
            return 1
        fi

        print_success "Backend images pushed successfully!"
        echo ""

        # Push frontend images
        print_info "Pushing frontend images..."
        if [ "$frontend_version" != "latest" ]; then
            docker push "${docker_username}/worklenz-frontend:${frontend_version}"
            if [ $? -ne 0 ]; then
                print_error "Frontend image push failed!"
                return 1
            fi
        fi
        docker push "${docker_username}/worklenz-frontend:latest"
        if [ $? -ne 0 ]; then
            print_error "Frontend latest image push failed!"
            return 1
        fi

        print_success "Frontend images pushed successfully!"
        echo ""
        print_success "Images are now available on Docker Hub!"
        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "  ${GREEN}Backend:${NC} https://hub.docker.com/r/${docker_username}/worklenz-backend"
        echo -e "  ${GREEN}Frontend:${NC} https://hub.docker.com/r/${docker_username}/worklenz-frontend"
        if [ "$backend_version" != "latest" ]; then
            echo -e "  ${GREEN}Tags:${NC} ${backend_version}, latest (backend) | ${frontend_version}, latest (frontend)"
        fi
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        print_info "Images built locally only (not pushed to Docker Hub)"
        print_info "To push later, use: ./manage.sh push"
    fi

    # Ask if user wants to start services after building
    echo ""
    read -p "Start services with the new images? (Y/n): " start_choice
    start_choice=${start_choice:-Y}

    if [[ "$start_choice" =~ ^[Yy]$ ]]; then
        echo ""
        print_info "Starting services..."
        start_services
    else
        print_info "To start services later, use: ./manage.sh start"
    fi
}

# Push images to Docker Hub
push_images() {
    print_header
    echo -e "${BLUE}Push Docker Images to Docker Hub${NC}"
    echo ""

    # Check prerequisites
    if ! check_docker; then
        return 1
    fi

    if [ ! -f "$ENV_FILE" ]; then
        print_error ".env file not found!"
        return 1
    fi

    load_env

    local docker_username="${DOCKER_USERNAME:-}"
    if [ -z "$docker_username" ]; then
        print_error "DOCKER_USERNAME not set in .env file!"
        print_info "Please set DOCKER_USERNAME or build images first"
        return 1
    fi

    # Get version numbers from environment or prompt
    local backend_version="${BACKEND_VERSION:-}"
    local frontend_version="${FRONTEND_VERSION:-}"

    echo ""
    echo -e "${YELLOW}Version Configuration${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ -z "$backend_version" ]; then
        read -p "Enter backend version to push (e.g., 2.1.5) [latest]: " backend_version
        backend_version=${backend_version:-latest}
    fi

    if [ -z "$frontend_version" ]; then
        read -p "Enter frontend version to push (e.g., 2.1.5) [latest]: " frontend_version
        frontend_version=${frontend_version:-latest}
    fi

    echo ""
    print_info "Docker Hub Username: $docker_username"
    print_info "Backend Version: $backend_version"
    print_info "Frontend Version: $frontend_version"
    echo ""

    # Check if images exist locally
    if ! docker images | grep -q "${docker_username}/worklenz-backend"; then
        print_error "Backend image not found locally!"
        print_info "Please build images first: ./manage.sh build"
        return 1
    fi

    if ! docker images | grep -q "${docker_username}/worklenz-frontend"; then
        print_error "Frontend image not found locally!"
        print_info "Please build images first: ./manage.sh build"
        return 1
    fi

    # Login to Docker Hub
    print_info "Logging in to Docker Hub..."
    echo ""
    docker login

    if [ $? -ne 0 ]; then
        print_error "Docker Hub login failed!"
        return 1
    fi

    echo ""
    print_success "Docker Hub login successful!"
    echo ""

    # Push backend images
    print_info "Pushing backend images to Docker Hub..."
    if [ "$backend_version" != "latest" ]; then
        print_info "Pushing ${docker_username}/worklenz-backend:${backend_version}..."
        docker push "${docker_username}/worklenz-backend:${backend_version}"
        if [ $? -ne 0 ]; then
            print_error "Backend version push failed!"
            return 1
        fi
    fi
    print_info "Pushing ${docker_username}/worklenz-backend:latest..."
    docker push "${docker_username}/worklenz-backend:latest"
    if [ $? -ne 0 ]; then
        print_error "Backend latest push failed!"
        return 1
    fi

    print_success "Backend images pushed successfully!"
    echo ""

    # Push frontend images
    print_info "Pushing frontend images to Docker Hub..."
    if [ "$frontend_version" != "latest" ]; then
        print_info "Pushing ${docker_username}/worklenz-frontend:${frontend_version}..."
        docker push "${docker_username}/worklenz-frontend:${frontend_version}"
        if [ $? -ne 0 ]; then
            print_error "Frontend version push failed!"
            return 1
        fi
    fi
    print_info "Pushing ${docker_username}/worklenz-frontend:latest..."
    docker push "${docker_username}/worklenz-frontend:latest"
    if [ $? -ne 0 ]; then
        print_error "Frontend latest push failed!"
        return 1
    fi

    print_success "Frontend images pushed successfully!"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}Backend:${NC} https://hub.docker.com/r/${docker_username}/worklenz-backend"
    echo -e "  ${GREEN}Frontend:${NC} https://hub.docker.com/r/${docker_username}/worklenz-frontend"
    if [ "$backend_version" != "latest" ]; then
        echo -e "  ${GREEN}Pushed Tags:${NC}"
        echo -e "    Backend: ${backend_version}, latest"
        echo -e "    Frontend: ${frontend_version}, latest"
    else
        echo -e "  ${GREEN}Pushed Tags:${NC} latest"
    fi
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Build and push (convenience function that calls both)
build_and_push_images() {
    build_images
    if [ $? -eq 0 ]; then
        echo ""
        push_images
    fi
}

# ============================================================================
# Installation Function
# ============================================================================

install_worklenz() {
    print_header
    echo -e "${BLUE}Installing Worklenz${NC}"
    echo ""

    # Check prerequisites
    if ! check_docker; then
        return 1
    fi

    # Check if .env exists, if not create from .env.example
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "${ENV_FILE}.example" ]; then
            print_info "Creating .env from .env.example..."
            cp "${ENV_FILE}.example" "$ENV_FILE"
            print_success ".env file created"
            echo ""
        else
            print_error ".env file not found and .env.example not found!"
            print_info "Please create .env file from .env.example"
            return 1
        fi
    fi

    # Ask for domain configuration
    echo ""
    echo -e "${YELLOW}Domain Configuration${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Enter your domain name:"
    echo "  - For local testing: enter 'localhost'"
    echo "  - For production: enter your domain (e.g., worklenz.example.com)"
    echo ""
    read -p "Domain [localhost]: " domain
    domain=${domain:-localhost}

    # Update DOMAIN in .env
    sed -i.bak "s/^DOMAIN=.*/DOMAIN=$domain/" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"

    print_success "Domain set to: $domain"

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

    # Auto-configure environment (generate secrets and update URLs)
    echo ""
    auto_configure_env

    load_env

    # Ask if user wants to build custom Docker images
    echo ""
    echo -e "${YELLOW}Docker Image Build${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Do you want to build custom Docker images?"
    echo "  - Answer 'yes' to build from source code"
    echo "  - Answer 'no' to use pre-built images from Docker Hub"
    echo ""
    read -p "Build custom images? (y/N): " build_choice

    if [[ "$build_choice" =~ ^[Yy]$ ]]; then
        echo ""
        print_info "Building custom Docker images..."

        # Build images without interactive prompts (already have username if needed)
        local docker_username="${DOCKER_USERNAME:-}"
        if [ -z "$docker_username" ]; then
            echo ""
            read -p "Enter Docker Hub username: " docker_username
            if [ -n "$docker_username" ]; then
                sed -i.bak "s/^DOCKER_USERNAME=.*/DOCKER_USERNAME=$docker_username/" "$ENV_FILE"
                rm -f "$ENV_FILE.bak"
                print_success "Docker Hub username saved: $docker_username"
            fi
        fi

        # Get version numbers
        local backend_version="${BACKEND_VERSION:-latest}"
        local frontend_version="${FRONTEND_VERSION:-latest}"

        if [ -n "$docker_username" ]; then
            # Build backend image
            print_info "Building backend image (version: ${backend_version})..."
            if [ "$backend_version" == "latest" ]; then
                docker build \
                    -f "$SCRIPT_DIR/worklenz-backend/Dockerfile" \
                    -t "${docker_username}/worklenz-backend:latest" \
                    "$SCRIPT_DIR/worklenz-backend"
            else
                docker build \
                    -f "$SCRIPT_DIR/worklenz-backend/Dockerfile" \
                    -t "${docker_username}/worklenz-backend:${backend_version}" \
                    -t "${docker_username}/worklenz-backend:latest" \
                    "$SCRIPT_DIR/worklenz-backend"
            fi

            if [ $? -ne 0 ]; then
                print_error "Backend build failed!"
                return 1
            fi

            print_success "Backend image built successfully!"
            echo ""

            # Build frontend image
            print_info "Building frontend image (version: ${frontend_version})..."
            if [ "$frontend_version" == "latest" ]; then
                docker build \
                    -f "$SCRIPT_DIR/worklenz-frontend/Dockerfile" \
                    -t "${docker_username}/worklenz-frontend:latest" \
                    "$SCRIPT_DIR/worklenz-frontend"
            else
                docker build \
                    -f "$SCRIPT_DIR/worklenz-frontend/Dockerfile" \
                    -t "${docker_username}/worklenz-frontend:${frontend_version}" \
                    -t "${docker_username}/worklenz-frontend:latest" \
                    "$SCRIPT_DIR/worklenz-frontend"
            fi

            if [ $? -ne 0 ]; then
                print_error "Frontend build failed!"
                return 1
            fi

            print_success "Frontend image built successfully!"
            echo ""

            # Update docker-compose.yaml
            print_info "Updating docker-compose.yaml..."
            sed -i.bak "s|image: .*/worklenz-backend:\${BACKEND_VERSION:-.*}|image: ${docker_username}/worklenz-backend:\${BACKEND_VERSION:-${backend_version}}|" "$DOCKER_COMPOSE_FILE"
            sed -i.bak "s|image: .*/worklenz-frontend:\${FRONTEND_VERSION:-.*}|image: ${docker_username}/worklenz-frontend:\${FRONTEND_VERSION:-${frontend_version}}|" "$DOCKER_COMPOSE_FILE"
            rm -f "$DOCKER_COMPOSE_FILE.bak"

            print_success "Custom images ready!"

            # Ask if user wants to push
            echo ""
            read -p "Push images to Docker Hub? (y/N): " push_choice
            if [[ "$push_choice" =~ ^[Yy]$ ]]; then
                print_info "Logging into Docker Hub..."
                docker login

                if [ $? -eq 0 ]; then
                    if [ "$backend_version" != "latest" ]; then
                        print_info "Pushing backend image (${backend_version})..."
                        docker push "${docker_username}/worklenz-backend:${backend_version}"
                    fi
                    print_info "Pushing backend image (latest)..."
                    docker push "${docker_username}/worklenz-backend:latest"

                    if [ "$frontend_version" != "latest" ]; then
                        print_info "Pushing frontend image (${frontend_version})..."
                        docker push "${docker_username}/worklenz-frontend:${frontend_version}"
                    fi
                    print_info "Pushing frontend image (latest)..."
                    docker push "${docker_username}/worklenz-frontend:latest"

                    print_success "Images pushed to Docker Hub!"
                fi
            fi
        fi
        echo ""
    fi

    # Setup SSL
    print_info "Setting up SSL certificates..."
    auto_setup_ssl

    echo ""
    print_info "Pulling images and starting services..."
    echo ""

    local compose_cmd=$(get_compose_cmd)
    local deployment_mode="${DEPLOYMENT_MODE:-express}"
    local compose_profiles="--profile $deployment_mode"

    if [[ "${ENABLE_SSL:-false}" == "true" ]]; then
        compose_profiles="$compose_profiles --profile ssl"
    fi

    # Pull images (will use pre-built images from Docker Hub)
    $compose_cmd $compose_profiles pull

    # Start services (will build only if image doesn't exist locally)
    $compose_cmd $compose_profiles up -d

    echo ""
    print_info "Waiting for services to initialize..."
    sleep 15

    # Check status
    echo ""
    $compose_cmd ps

    echo ""
    print_success "Installation completed!"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}Access Worklenz at:${NC} ${VITE_API_URL:-https://localhost}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============================================================================
# Upgrade Function
# ============================================================================

upgrade_worklenz() {
    print_header
    echo -e "${BLUE}Upgrade Worklenz${NC}"
    echo ""

    print_warning "This will pull latest images and rebuild containers"
    read -p "Continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 0
    fi

    # Create backup first
    print_info "Creating backup before upgrade..."
    backup_data

    load_env
    local compose_cmd=$(get_compose_cmd)
    local deployment_mode="${DEPLOYMENT_MODE:-express}"
    local compose_profiles="--profile $deployment_mode"

    if [[ "${ENABLE_SSL:-false}" == "true" ]]; then
        compose_profiles="$compose_profiles --profile ssl"
    fi

    # Pull latest
    print_info "Pulling latest images..."
    $compose_cmd $compose_profiles pull

    # Rebuild
    print_info "Rebuilding services..."
    $compose_cmd $compose_profiles build --no-cache

    # Restart
    print_info "Restarting services..."
    $compose_cmd $compose_profiles up -d

    echo ""
    print_success "Upgrade completed!"
}

# ============================================================================
# SSL Management
# ============================================================================

manage_ssl() {
    print_header
    echo -e "${BLUE}SSL/TLS Management${NC}"
    echo ""
    echo "1. Setup Self-Signed SSL (localhost)"
    echo "2. Setup Let's Encrypt SSL (domain)"
    echo "3. Renew Let's Encrypt Certificate"
    echo "4. View Certificate Info"
    echo "0. Back"
    echo ""

    read -p "Enter choice [0-4]: " ssl_choice

    case $ssl_choice in
        1)
            setup_self_signed_ssl
            read -p "Press Enter to continue..."
            ;;
        2)
            load_env
            setup_letsencrypt_ssl
            read -p "Press Enter to continue..."
            ;;
        3)
            print_info "Renewing Let's Encrypt certificate..."
            local compose_cmd=$(get_compose_cmd)
            $compose_cmd run --rm certbot renew
            $compose_cmd restart nginx
            print_success "Certificate renewed"
            read -p "Press Enter to continue..."
            ;;
        4)
            if [ -f "$SSL_DIR/cert.pem" ]; then
                print_info "Self-signed certificate info:"
                openssl x509 -in "$SSL_DIR/cert.pem" -text -noout | grep -E "(Subject:|Issuer:|Not Before|Not After)"
            fi
            load_env
            if [ ! -z "${DOMAIN}" ] && [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
                print_info "Let's Encrypt certificate info:"
                docker run --rm -v worklenz_certbot_certs:/etc/letsencrypt alpine/openssl x509 -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" -text -noout | grep -E "(Subject:|Issuer:|Not Before|Not After)"
            fi
            read -p "Press Enter to continue..."
            ;;
        0)
            return
            ;;
        *)
            print_error "Invalid choice"
            sleep 2
            ;;
    esac
}

# ============================================================================
# Main Menu
# ============================================================================

show_menu() {
    print_header
    echo -e "${YELLOW}Main Menu${NC}"
    echo ""
    echo " 1. Install Worklenz"
    echo " 2. Start Services"
    echo " 3. Stop Services"
    echo " 4. Restart Services"
    echo " 5. Service Status"
    echo " 6. View Logs"
    echo " 7. Backup Data"
    echo " 8. Restore Data"
    echo " 9. Upgrade Worklenz"
    echo "10. Configure Environment"
    echo "11. Manage SSL/TLS"
    echo "12. Build Images"
    echo "13. Push Images to Docker Hub"
    echo " 0. Exit"
    echo ""
}

main() {
    while true; do
        show_menu
        read -p "Enter choice [0-13]: " choice
        echo

        case $choice in
            1)
                install_worklenz
                read -p "Press Enter to continue..."
                ;;
            2)
                start_services
                read -p "Press Enter to continue..."
                ;;
            3)
                stop_services
                read -p "Press Enter to continue..."
                ;;
            4)
                restart_services
                read -p "Press Enter to continue..."
                ;;
            5)
                service_status
                read -p "Press Enter to continue..."
                ;;
            6)
                view_logs
                ;;
            7)
                backup_data
                read -p "Press Enter to continue..."
                ;;
            8)
                restore_data
                read -p "Press Enter to continue..."
                ;;
            9)
                upgrade_worklenz
                read -p "Press Enter to continue..."
                ;;
            10)
                configure_env
                read -p "Press Enter to continue..."
                ;;
            11)
                manage_ssl
                ;;
            12)
                build_images
                read -p "Press Enter to continue..."
                ;;
            13)
                push_images
                read -p "Press Enter to continue..."
                ;;
            0)
                print_info "Exiting..."
                exit 0
                ;;
            *)
                print_error "Invalid choice"
                sleep 2
                ;;
        esac
    done
}

# ============================================================================
# Command-line Interface
# ============================================================================

# Handle command-line arguments
if [ $# -gt 0 ]; then
    case "$1" in
        install)
            install_worklenz
            ;;
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            service_status
            ;;
        logs)
            view_logs
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data
            ;;
        upgrade)
            upgrade_worklenz
            ;;
        configure|config)
            configure_env
            ;;
        auto-configure|auto-config)
            auto_configure_env
            ;;
        ssl)
            manage_ssl
            ;;
        build)
            build_images
            ;;
        push)
            push_images
            ;;
        build-push)
            build_and_push_images
            ;;
        help|--help|-h)
            echo "Worklenz Management Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  install          Install Worklenz (auto-generates secrets)"
            echo "  start            Start all services"
            echo "  stop             Stop all services"
            echo "  restart          Restart all services"
            echo "  status           Show service status"
            echo "  logs             View service logs"
            echo "  backup           Create database backup"
            echo "  restore          Restore from backup"
            echo "  upgrade          Upgrade to latest version"
            echo "  configure        Interactive configuration"
            echo "  auto-configure   Auto-configure from .env DOMAIN"
            echo "  ssl              Manage SSL certificates"
            echo "  build            Build Docker images locally"
            echo "  push             Push images to Docker Hub"
            echo "  build-push       Build and push in one step"
            echo "  help             Show this help message"
            echo ""
            echo "If no command is provided, interactive menu will be shown."
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
else
    # Run main menu if no arguments
    main
fi
