#!/bin/bash

# Script to set environment variables for Docker deployment
# Usage: ./update-docker-env.sh [hostname] [use_ssl]

# Default hostname if not provided
DEFAULT_HOSTNAME="localhost"
HOSTNAME=${1:-$DEFAULT_HOSTNAME}

# Check if SSL should be used
USE_SSL=${2:-false}

# Set protocol prefixes based on SSL flag
if [ "$USE_SSL" = "true" ]; then
  HTTP_PREFIX="https://"
  WS_PREFIX="wss://"
else
  HTTP_PREFIX="http://"
  WS_PREFIX="ws://"
fi

# Frontend URLs
FRONTEND_URL="${HTTP_PREFIX}${HOSTNAME}:5000"
MINIO_DASHBOARD_URL="${HTTP_PREFIX}${HOSTNAME}:9001"

# Create or overwrite frontend .env.development file
mkdir -p worklenz-frontend
cat > worklenz-frontend/.env.development << EOL
# API Connection
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=ws://localhost:3000

# Application Environment
VITE_APP_TITLE=Worklenz
VITE_APP_ENV=development

# Mixpanel
VITE_MIXPANEL_TOKEN=

# Recaptcha
VITE_ENABLE_RECAPTCHA=false
VITE_RECAPTCHA_SITE_KEY=

# Session ID
VITE_WORKLENZ_SESSION_ID=worklenz-session-id
EOL

# Create frontend .env.production file
cat > worklenz-frontend/.env.production << EOL
# API Connection
VITE_API_URL=${HTTP_PREFIX}${HOSTNAME}:3000
VITE_SOCKET_URL=${WS_PREFIX}${HOSTNAME}:3000

# Application Environment
VITE_APP_TITLE=Worklenz
VITE_APP_ENV=production

# Mixpanel
VITE_MIXPANEL_TOKEN=

# Recaptcha
VITE_ENABLE_RECAPTCHA=false
VITE_RECAPTCHA_SITE_KEY=

# Session ID
VITE_WORKLENZ_SESSION_ID=worklenz-session-id
EOL

# Create backend environment file
mkdir -p worklenz-backend
cat > worklenz-backend/.env << EOL
# Server
NODE_ENV=production
PORT=3000
SESSION_NAME=worklenz.sid
SESSION_SECRET=change_me_in_production
COOKIE_SECRET=change_me_in_production

# CORS
SOCKET_IO_CORS=${FRONTEND_URL}
SERVER_CORS=${FRONTEND_URL}

# Database
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=worklenz_db
DB_MAX_CLIENTS=50
USE_PG_NATIVE=true

# Storage Configuration
STORAGE_PROVIDER=s3
AWS_REGION=us-east-1
AWS_BUCKET=worklenz-bucket
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_URL=http://minio:9000

# Backend Directories
BACKEND_PUBLIC_DIR=./public
BACKEND_VIEWS_DIR=./views

# Host
HOSTNAME=${HOSTNAME}
FRONTEND_URL=${FRONTEND_URL}

# Email
SOURCE_EMAIL=no-reply@example.com

# Notifications
SLACK_WEBHOOK=

# Other Settings
COMMIT_BUILD_IMMEDIATELY=true

# JWT Secret
JWT_SECRET=change_me_in_production
EOL

echo "Environment configuration updated for ${HOSTNAME} with" $([ "$USE_SSL" = "true" ] && echo "HTTPS/WSS" || echo "HTTP/WS")
echo "Created/updated environment files:"
echo "- worklenz-frontend/.env.development (development)"
echo "- worklenz-frontend/.env.production (production build)"
echo "- worklenz-backend/.env"
echo
echo "To run with Docker Compose, use: docker-compose up -d"
echo
echo "Frontend URL: ${FRONTEND_URL}"
echo "API URL: ${HTTP_PREFIX}${HOSTNAME}:3000"
echo "Socket URL: ${WS_PREFIX}${HOSTNAME}:3000"
echo "MinIO Dashboard URL: ${MINIO_DASHBOARD_URL}"
echo "CORS is configured to allow requests from: ${FRONTEND_URL}" 