# Docker Setup Guide - Production-Ready Worklenz

This repository now includes a **production-ready Docker setup** with enterprise-grade features including nginx reverse proxy, SSL/TLS support, Redis caching, automated backups, and comprehensive management scripts.

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
./quick-setup.sh
```
- Install and start Worklenz

During the process, you will be prompted for:
1. **Domain**: Enter `localhost` for local testing. For production, enter your server's domain.
2. **Build and push images**: Answer `no` (recommended) to use pre-built images from Docker Hub, which is much faster. Answer `yes` only if you want to build custom images.
3. **Docker Hub username**: If you chose to build custom images, enter your Docker Hub username. This is used to tag and push the images to your own repository.

### Option 2: Manual Setup
```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env and set required values:
#    - DB_PASSWORD
#    - SESSION_SECRET (generate with: openssl rand -hex 32)
#    - COOKIE_SECRET (generate with: openssl rand -hex 32)
#    - JWT_SECRET (generate with: openssl rand -hex 32)
#    - AWS_SECRET_ACCESS_KEY (MinIO password)
#    - REDIS_PASSWORD

# 3. Start services (Express mode - includes PostgreSQL, Redis, MinIO)
docker compose --profile express up -d

# 4. For production with SSL
docker compose --profile express --profile ssl up -d
```

## 📋 What's New

### 1. **Production-Ready Docker Compose**
- **Nginx reverse proxy** with SSL/TLS termination
- **Redis cache** for session management
- **Automated database backups** with retention policies
- **Health checks** for all services
- **Network isolation** (separate backend/frontend networks)
- **Security hardening** (non-root users, no-new-privileges)
- **Profile-based deployment** (express/advanced modes)

### 2. **Enhanced Dockerfiles**

#### Backend Dockerfile
- Multi-stage build for smaller images
- Non-root user (`worklenz`) for security
- `tini` init system for proper signal handling
- Health check endpoint
- `libvips42` for image processing
- Proper log directory with permissions

#### Frontend Dockerfile
- Multi-stage build with Alpine Linux
- Non-root user for security
- Runtime environment injection (supports reCAPTCHA, Google Login, etc.)
- `tini` init system
- Health check endpoint
- Optimized `serve` configuration

### 3. **Nginx Configuration**
- **SSL/TLS support** (Let's Encrypt + self-signed)
- **Rate limiting** (API and login endpoints)
- **WebSocket support** for Socket.IO
- **Security headers** (HSTS, CSP, X-Frame-Options, etc.)
- **Gzip compression**
- **Static asset caching**
- **Upstream load balancing**

### 4. **Database Initialization**
- **Backup restoration** on startup
- **Migration tracking** system
- **Proper error handling**
- **Initialization marker** to prevent re-runs

### 5. **Management Scripts**

#### `manage.sh` - Comprehensive Management
```bash
./manage.sh [command]

Commands:
  install          Install Worklenz (auto-generates secrets)
  start            Start all services
  stop             Stop all services
  restart          Restart all services
  status           Show service status
  logs             View service logs
  backup           Create database backup
  restore          Restore from backup
  upgrade          Upgrade to latest version
  configure        Interactive configuration
  auto-configure   Auto-configure from .env DOMAIN
  ssl              Manage SSL certificates
  build            Build Docker images locally
  push             Push images to Docker Hub
  build-push       Build and push in one step
```

#### `quick-setup.sh` - Automated Installation
One-command setup with auto-generated secrets and SSL configuration.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Port 80/443)                  │
│              SSL/TLS, Rate Limiting, Caching            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐       ┌───────▼────────┐
│   Frontend     │       │    Backend     │
│  (Node:22)     │       │   (Node:20)    │
│  Port: 5000    │       │   Port: 3000   │
└────────────────┘       └───────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼──┐   ┌────▼────┐  ┌───▼────┐
            │PostgreSQL│   │  Redis  │  │ MinIO  │
            │  Port:   │   │ Port:   │  │ Port:  │
            │  5432    │   │  6379   │  │ 9000   │
            └──────────┘   └─────────┘  └────────┘
```

## 🔧 Configuration

### Deployment Modes

#### Express Mode (Default)
All services bundled together - PostgreSQL, Redis, MinIO included.
```bash
docker compose --profile express up -d
```

#### Advanced Mode
Use external services (AWS S3, Azure Blob, external PostgreSQL).
```bash
# Set in .env:
DEPLOYMENT_MODE=advanced
STORAGE_PROVIDER=s3  # or azure

docker compose up -d
```

### Environment Variables

Key variables in `.env`:
- `DOMAIN` - Your domain (localhost for local testing)
- `DEPLOYMENT_MODE` - express or advanced
- `STORAGE_PROVIDER` - s3 or azure
- `ENABLE_SSL` - true/false
- `BACKUP_RETENTION_DAYS` - Days to keep backups (default: 30)

See `.env.example` for complete documentation.

## 🔐 Security Features

1. **Non-root containers** - All services run as non-root users
2. **Security options** - `no-new-privileges` enabled
3. **Network isolation** - Backend network is internal-only
4. **SSL/TLS** - Let's Encrypt for production, self-signed for localhost
5. **Rate limiting** - API and login endpoints protected
6. **Security headers** - HSTS, CSP, X-Frame-Options, etc.
7. **Secret management** - Auto-generated secure secrets

## 💾 Backup & Restore

### Automated Backups
Database backups run automatically every 24 hours with configurable retention:
```bash
# Enable backup service
docker compose --profile backup up -d
```

### Manual Backup
```bash
./manage.sh backup
```

### Restore from Backup
```bash
./manage.sh restore
```

Backups are stored in `./backups/` directory and compressed with gzip.

## 🌐 SSL/TLS Setup

### Localhost (Self-Signed)
Automatically configured for localhost testing.

### Production Domain (Let's Encrypt)
```bash
# 1. Set domain in .env
DOMAIN=your-domain.com
ENABLE_SSL=true
LETSENCRYPT_EMAIL=your-email@domain.com

# 2. Point DNS A record to your server IP

# 3. Start with SSL profile
docker compose --profile express --profile ssl up -d
```

Or use the management script:
```bash
./manage.sh ssl
```

## 📊 Monitoring

### View Service Status
```bash
./manage.sh status
# or
docker compose ps
```

### View Logs
```bash
./manage.sh logs
# or
docker compose logs -f [service-name]
```

### Health Checks
All services include health checks:
- Backend: `http://localhost:3000/public/health`
- Frontend: `http://localhost:5000`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- MinIO: `/minio/health/live`

## 🔄 Upgrading

```bash
./manage.sh upgrade
```

This will:
1. Create a backup
2. Pull latest images
3. Rebuild containers
4. Restart services

## 🐳 Building Custom Images

### Build Locally
```bash
./manage.sh build
```

### Push to Docker Hub
```bash
./manage.sh push
```

### Build and Push
```bash
./manage.sh build-push
```

## 📁 Directory Structure

```
worklenz/
├── docker-compose.yaml          # Main compose file
├── .env.example                 # Environment template
├── manage.sh                    # Management script
├── quick-setup.sh              # Quick setup script
├── nginx/                      # Nginx configuration
│   ├── nginx.conf
│   ├── conf.d/
│   │   └── worklenz.conf
│   └── ssl/                    # SSL certificates
├── scripts/                    # Database scripts
│   └── db-init-wrapper.sh
├── backups/                    # Database backups
├── worklenz-backend/
│   └── Dockerfile              # Backend Dockerfile
└── worklenz-frontend/
    └── Dockerfile              # Frontend Dockerfile
```

## ❓ FAQ

### What if Docker is not installed?
You must install Docker and Docker Desktop (for Windows/Mac) or Docker Engine (for Linux). Follow the official [Docker installation guide](https://docs.docker.com/get-docker/).

### How do I install Docker Compose?
Modern Docker installations (Docker Desktop and latest Docker Engine) include Docker Compose by default. You can check by running `docker compose version`. If you need to install it separately, see the [Compose installation guide](https://docs.docker.com/compose/install/).

### Why do I get "permission denied" errors on Linux?
On Linux, you may need to run Docker commands with `sudo` or add your user to the `docker` group:
```bash
sudo usermod -aG docker $USER
```
*Note: You may need to log out and back in for this change to take effect.*

### I'm on Windows, why isn't it working?
For the best experience on Windows, we recommend using **WSL2** (Windows Subsystem for Linux).
1. Install [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install).
2. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/).
3. Enable WSL2 integration in Docker Desktop Settings -> Resources -> WSL Integration.

### How do I check if my hardware supports virtualization?
- **Windows**: Check Performance tab in Task Manager. Look for "Virtualization: Enabled".
- **Linux**: Run `lscpu | grep Virtualization`.

## 🆘 Troubleshooting

### Services won't start
```bash
# Check logs
docker compose logs

# Check service status
docker compose ps

# Restart services
./manage.sh restart
```

### Database initialization fails
```bash
# Check database logs
docker compose logs postgres

# Verify database scripts exist
ls -la worklenz-backend/database/sql/
```

### SSL certificate issues
```bash
# For Let's Encrypt
./manage.sh ssl

# Check certificate info
openssl x509 -in nginx/ssl/cert.pem -text -noout
```

### Port conflicts
```bash
# Change ports in .env
HTTP_PORT=8080
HTTPS_PORT=8443
```

## 📝 Migration from Old Setup

If you're migrating from the old `docker-compose.yml`:

1. **Backup your data**:
   ```bash
   docker compose exec db pg_dump -U postgres worklenz_db > backup.sql
   ```

2. **Stop old containers**:
   ```bash
   docker compose -f docker-compose.yml down
   ```

3. **Copy your `.env` files** to the new structure

4. **Start new setup**:
   ```bash
   docker compose --profile express up -d
   ```

5. **Restore data if needed**:
   ```bash
   ./manage.sh restore
   ```

## 🤝 Contributing

When making changes to Docker configuration:
1. Test with both express and advanced modes
2. Verify health checks work
3. Test SSL setup for both localhost and production
4. Update this documentation
