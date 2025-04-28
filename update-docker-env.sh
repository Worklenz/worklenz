#!/bin/bash

# Script to set environment variables for Docker deployment
# Usage: ./update-docker-env.sh [hostname]

# Default hostname if not provided
DEFAULT_HOSTNAME="localhost"
HOSTNAME=${1:-$DEFAULT_HOSTNAME}

# Create or update root .env file
cat > .env << EOL
# Frontend Configuration
VITE_API_URL=http://${HOSTNAME}:3000

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

echo "Environment configuration updated for ${HOSTNAME}"
echo "To run with Docker Compose, use: docker-compose up -d" 