# Production-ready Dockerfile for Worklenz Frontend
# Based on official Worklenz frontend structure with runtime environment injection
# Multi-stage build with optimized production setup

# Stage 1: Build stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && \
    npm cache clean --force

# Copy frontend source code
COPY . ./

# Set build-time environment variables to use runtime variables as fallback
ENV VITE_API_URL=__VITE_API_URL__
ENV VITE_SOCKET_URL=__VITE_SOCKET_URL__

# Build React application for production with Vite
RUN npm run build

# Stage 2: Production stage
FROM node:22-alpine

# Create non-root user
RUN addgroup -g 1001 -S worklenz && \
    adduser -S -u 1001 -G worklenz worklenz

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    curl \
    && npm install -g serve@14.2.1 \
    && npm cache clean --force

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=worklenz:worklenz /app/build ./build

# Create env-config.js placeholder
RUN echo "window.VITE_API_URL = \"\";" > /app/build/env-config.js && \
    echo "window.VITE_SOCKET_URL = \"\";" >> /app/build/env-config.js && \
    echo "window.VITE_APP_TITLE = \"\";" >> /app/build/env-config.js && \
    echo "window.VITE_APP_ENV = \"\";" >> /app/build/env-config.js && \
    echo "window.VITE_ENABLE_RECAPTCHA = \"\";" >> /app/build/env-config.js && \
    echo "window.VITE_RECAPTCHA_SITE_KEY = \"\";" >> /app/build/env-config.js && \
    echo "window.VITE_ENABLE_GOOGLE_LOGIN = \"\";" >> /app/build/env-config.js && \
    echo "window.VITE_ENABLE_SURVEY_MODAL = \"\";" >> /app/build/env-config.js && \
    chown worklenz:worklenz /app/build/env-config.js

# Create runtime environment configuration script
COPY --chown=worklenz:worklenz <<'EOF' /app/env-config.sh
#!/bin/sh
# Generate env-config.js with runtime environment variables
cat > /app/build/env-config.js << ENVEOF
window.VITE_API_URL = "${VITE_API_URL}";
window.VITE_SOCKET_URL = "${VITE_SOCKET_URL}";
window.VITE_APP_TITLE = "${VITE_APP_TITLE:-Worklenz}";
window.VITE_APP_ENV = "${VITE_APP_ENV:-production}";
window.VITE_ENABLE_RECAPTCHA = "${VITE_ENABLE_RECAPTCHA:-false}";
window.VITE_RECAPTCHA_SITE_KEY = "${VITE_RECAPTCHA_SITE_KEY:-}";
window.VITE_ENABLE_GOOGLE_LOGIN = "${VITE_ENABLE_GOOGLE_LOGIN:-false}";
window.VITE_ENABLE_SURVEY_MODAL = "${VITE_ENABLE_SURVEY_MODAL:-false}";
ENVEOF
EOF

RUN chmod +x /app/env-config.sh

# Create startup script
COPY --chown=worklenz:worklenz <<'EOF' /app/start.sh
#!/bin/sh
set -e
echo "Generating runtime environment configuration..."
/app/env-config.sh
echo "Starting frontend server..."
exec serve -s /app/build -l 5000 --no-request-logging
EOF

RUN chmod +x /app/start.sh

# Switch to non-root user
USER worklenz

# Expose frontend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:5000 || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with runtime environment injection
CMD ["/app/start.sh"]