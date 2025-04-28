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

# Create or update root .env file
cat > .env << EOL
# Frontend Configuration
VITE_API_URL=${HTTP_PREFIX}${HOSTNAME}:3000
VITE_SOCKET_URL=${WS_PREFIX}${HOSTNAME}:3000

# Backend Configuration
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=worklenz_db
NODE_ENV=development
PORT=3000

# Storage Configuration
AWS_REGION=us-east-1
STORAGE_PROVIDER=s3
BUCKET=worklenz-bucket
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_URL=http://minio:9000
EOL

echo "Environment configuration updated for ${HOSTNAME} with" $([ "$USE_SSL" = "true" ] && echo "HTTPS/WSS" || echo "HTTP/WS")
echo "To run with Docker Compose, use: docker-compose up -d"
echo
echo "API URL: ${VITE_API_URL:-${HTTP_PREFIX}${HOSTNAME}:3000}"
echo "Socket URL: ${VITE_SOCKET_URL:-${WS_PREFIX}${HOSTNAME}:3000}" 