#!/bin/bash

# Worklenz Client Portal Deployment Script
# This script helps deploy the client portal to nginx

set -e

echo "🚀 Starting Worklenz Client Portal Deployment..."

# Configuration
DOMAIN="clients.worklenz.com"
NGINX_CONF_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
WEB_ROOT="/var/www/clients.worklenz.com"
BUILD_DIR="worklenz-client-portal/dist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Step 1: Build the application
print_status "Building the client portal application..."
cd worklenz-client-portal
npm install
npm run build
cd ..

# Step 2: Create web directory
print_status "Creating web directory..."
mkdir -p $WEB_ROOT

# Step 3: Copy built files
print_status "Copying built files to web directory..."
cp -r $BUILD_DIR/* $WEB_ROOT/

# Step 4: Set proper permissions
print_status "Setting proper permissions..."
chown -R www-data:www-data $WEB_ROOT
chmod -R 755 $WEB_ROOT

# Step 5: Copy nginx configuration
print_status "Installing nginx configuration..."
cp nginx-clients-worklenz.conf $NGINX_CONF_DIR/$DOMAIN

# Step 6: Create symbolic link to enable the site
print_status "Enabling nginx site..."
ln -sf $NGINX_CONF_DIR/$DOMAIN $NGINX_ENABLED_DIR/$DOMAIN

# Step 7: Test nginx configuration
print_status "Testing nginx configuration..."
if nginx -t; then
    print_status "Nginx configuration test passed!"
else
    print_error "Nginx configuration test failed!"
    exit 1
fi

# Step 8: Reload nginx
print_status "Reloading nginx..."
systemctl reload nginx

print_status "✅ Deployment completed successfully!"
echo ""
print_warning "IMPORTANT: Please update the following in the nginx configuration:"
echo "  1. SSL certificate paths in $NGINX_CONF_DIR/$DOMAIN"
echo "  2. Backend API proxy settings if needed"
echo "  3. Domain-specific configurations"
echo ""
print_status "Configuration file location: $NGINX_CONF_DIR/$DOMAIN"
print_status "Web files location: $WEB_ROOT"
print_status "Access your site at: https://$DOMAIN"
