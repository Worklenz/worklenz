# Production-ready Dockerfile for Worklenz Frontend
# Uses nginx to serve static files AND proxy API requests to backend (same-origin)

# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci && \
    npm cache clean --force

COPY . ./

# Set build-time environment variables to use runtime variables as fallback
ENV VITE_API_URL=__VITE_API_URL__
ENV VITE_SOCKET_URL=__VITE_SOCKET_URL__

# Build React application for production with Vite
RUN npm run build

# Stage 2: Production stage with nginx
FROM nginx:1.27-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/build /usr/share/nginx/html

# PPM-OVERRIDE: Same-origin setup — startup script generates nginx config + env-config.js
# Renamed from 90-ppm-config.sh to bust Docker layer cache (v2)
COPY docker/90-ppm-startup.sh /docker-entrypoint.d/90-ppm-startup.sh
RUN chmod +x /docker-entrypoint.d/90-ppm-startup.sh

# Remove default nginx template and any old script to avoid conflicts
RUN rm -f /etc/nginx/templates/default.conf.template /docker-entrypoint.d/90-ppm-config.sh

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1
