# Production-ready Dockerfile for Worklenz Backend
# Based on official Worklenz backend structure
# Multi-stage build for optimal image size and security

# Stage 1: Build stage
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    postgresql-server-dev-all \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy backend source code
COPY . ./

# Build TypeScript application
RUN npm run build

# Create release version file
RUN echo "$(date '+%Y-%m-%d %H:%M:%S')" > build/RELEASE_VERSION

# Stage 2: Production stage
FROM node:20-slim

# Create non-root user for security
RUN groupadd -r worklenz && useradd -r -g worklenz worklenz

# Install runtime dependencies only (no build tools needed if we copy from builder)
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    tini \
    ca-certificates \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production node_modules from builder stage to avoid network issues
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=worklenz:worklenz /app/build ./build

# Copy release file from builder
COPY --from=builder --chown=worklenz:worklenz /app/build/RELEASE_VERSION ./release

# Copy email templates
COPY --from=builder --chown=worklenz:worklenz /app/worklenz-email-templates ./worklenz-email-templates

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R worklenz:worklenz /app

# Switch to non-root user
USER worklenz

# Expose backend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/public/health || exit 1

# Use tini as init system
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start application
CMD ["node", "build/bin/www.js"]
