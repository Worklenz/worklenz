<h1 align="center">
    <a href="https://worklenz.com" target="_blank" rel="noopener noreferrer">
        <img src="https://s3.dualstack.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-light-mode.png" alt="Worklenz Logo" width="400">
    </a>  
</h1>
<h3 align="center">All-in-one open-source project management for efficient teams</h3>

<p align="center">
    <a href="https://github.com/Worklenz/worklenz/blob/main/LICENSE">
        <img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License">
    </a>
    <a href="https://github.com/Worklenz/worklenz/releases">
        <img src="https://img.shields.io/github/v/release/Worklenz/worklenz" alt="Release">
    </a>
    <a href="https://github.com/Worklenz/worklenz/stargazers">
        <img src="https://img.shields.io/github/stars/Worklenz/worklenz" alt="Stars">
    </a>
    <a href="https://github.com/Worklenz/worklenz/network/members">
        <img src="https://img.shields.io/github/forks/Worklenz/worklenz" alt="Forks">
    </a>
    <a href="https://github.com/Worklenz/worklenz/issues">
        <img src="https://img.shields.io/github/issues/Worklenz/worklenz" alt="Issues">
    </a>
    <a href="https://discord.gg/AVbkGXHA">
        <img src="https://img.shields.io/discord/1202616582757556276?style=flat&logo=discord&logoColor=white&label=Discord&color=5865F2" alt="Issues">
    </a>
</p>

<p align="center">
    <a href="https://worklenz.com"><b>Website</b></a> •
    <a href="https://worklenz.com"><b>Free sign up</b></a> •
    <a href="https://github.com/Worklenz/worklenz/releases"><b>Releases</b></a> •
    <a href="https://docs.worklenz.com/en/start/introduction/"><b>Documentation</b></a>
</p>


Meet [Worklenz](https://worklenz.com) a powerful, open-source project management platform built to help teams plan smarter, collaborate better, and ship faster. No bloated tools. No unnecessary complexity. Just everything your team needs, in one place. 🚀
> Worklenz is growing every day. Your bug reports, feature ideas, and feedback shape what we build next. Jump into [Discord](https://discord.gg/AVbkGXHA) or open a GitHub issue - we read everything!
## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Quick Start (Docker)](#-quick-start-docker---recommended)
  - [Manual Installation](#️-manual-installation-for-development)
- [Deployment](#deployment)
  - [Local Development](#local-development-with-docker)
  - [Remote Server Deployment](#remote-server-deployment)
- [Configuration](#configuration)
- [MinIO Integration](#minio-integration)
- [Security](#security)
- [Analytics](#analytics)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Project Planning**: Create and organize projects, assign tasks to team members.
- **Task Management**: Break down projects into smaller tasks, set due dates, priorities, and track progress.
- **Collaboration**: Share files, leave comments, and communicate seamlessly with your team members.
- **Time Tracking**: Monitor time spent on tasks and projects for better resource allocation and billing.
- **Reporting**: Generate detailed reports on project status, team workload, and performance metrics.

## Tech Stack

This repository contains the frontend and backend code for Worklenz.

- **Frontend**: Built using React with Ant Design as the UI library.
- **Backend**: Built using TypeScript, Express.js, with PostgreSQL as the database.

## Requirements

- Node.js version v18 or newer
- PostgreSQL version v15 or newer
- Docker and Docker Compose (for containerized setup)

## Getting Started

Choose your preferred setup method below. Docker is recommended for quick setup and testing.

### 🚀 Quick Start (Docker - Recommended)

The fastest way to get Worklenz running locally with all dependencies included. This setup includes **production-ready features** like nginx reverse proxy, SSL/TLS support, Redis caching, and automated backups.

**Prerequisites:**
- Docker and Docker Compose installed on your system
- Git

**Steps:**

#### Option 1: Automated Setup (Easiest)
```bash
# Clone the repository
git clone https://github.com/Worklenz/worklenz.git
cd worklenz

# Run the automated setup script
./quick-setup.sh
```

This script will:
- Create `.env` file with auto-generated security secrets
- Configure URLs based on your domain (localhost or production)
- Set up SSL certificates (self-signed for localhost, Let's Encrypt for production)
- Install and start all services

#### Option 2: Manual Setup
```bash
# Clone the repository
git clone https://github.com/Worklenz/worklenz.git
cd worklenz

# Copy and configure environment file
cp .env.example .env
# Edit .env and set required values (DB_PASSWORD, SESSION_SECRET, etc.)

# Start services (Express mode - includes PostgreSQL, Redis, MinIO)
docker compose --profile express up -d
```

**Access the application:**
- **Application**: https://localhost (or http://localhost)
- **MinIO Console**: http://localhost:9001 (login: minioadmin/minioadmin)

**Management:**
```bash
# Use the management script for common operations
./manage.sh status    # View service status
./manage.sh logs      # View logs
./manage.sh backup    # Create database backup
./manage.sh stop      # Stop all services
./manage.sh start     # Start all services
```

**For detailed documentation**, see [DOCKER_SETUP.md](DOCKER_SETUP.md)

**Video Guide**: For a visual walkthrough of the local Docker deployment process, check out our [step-by-step video guide](https://www.youtube.com/watch?v=AfwAKxJbqLg).

### 🛠️ Manual Installation (For Development)

For developers who want to run the services individually or customize the setup.

**Prerequisites:**
- Node.js (version 18 or higher)
- PostgreSQL (version 15 or higher)
- An S3-compatible storage service (like MinIO) or Azure Blob Storage

**Steps:**

1. Clone the repository:
```bash
git clone https://github.com/Worklenz/worklenz.git
cd worklenz
```

2. Set up environment variables:
```bash
cp worklenz-backend/.env.template worklenz-backend/.env
# Update the environment variables with your configuration
```

3. Install dependencies:
```bash
# Backend dependencies
cd worklenz-backend
npm install

# Frontend dependencies
cd ../worklenz-frontend
npm install
```

4. Set up the database:
```bash
# Create a PostgreSQL database named worklenz_db
cd worklenz-backend

# Execute the SQL setup files in the correct order
psql -U your_username -d worklenz_db -f database/sql/0_extensions.sql
psql -U your_username -d worklenz_db -f database/sql/1_tables.sql
psql -U your_username -d worklenz_db -f database/sql/indexes.sql
psql -U your_username -d worklenz_db -f database/sql/4_functions.sql
psql -U your_username -d worklenz_db -f database/sql/triggers.sql
psql -U your_username -d worklenz_db -f database/sql/3_views.sql
psql -U your_username -d worklenz_db -f database/sql/2_dml.sql
psql -U your_username -d worklenz_db -f database/sql/5_database_user.sql
```

5. Start the development servers:
```bash
# Backend (single command for build, watch, and auto-restart)
cd worklenz-backend
npm run dev:all

# Frontend (in another terminal)
cd worklenz-frontend
npm run dev
```

6. Access the application at http://localhost:5000

## Deployment

### Local Development

For local development, follow the [Quick Start (Docker)](#-quick-start-docker---recommended) section above.

### Production Deployment

The new Docker setup includes production-ready features for secure and scalable deployments.

#### Quick Production Setup

```bash
# Clone and navigate to the repository
git clone https://github.com/Worklenz/worklenz.git
cd worklenz

# Run the automated setup
./quick-setup.sh
# When prompted, enter your production domain (e.g., worklenz.example.com)
# The script will configure SSL with Let's Encrypt automatically
```

#### Manual Production Setup

1. **Configure environment for your domain:**
   ```bash
   cp .env.example .env
   # Edit .env and set:
   # - DOMAIN=your-domain.com
   # - VITE_API_URL=https://your-domain.com
   # - VITE_SOCKET_URL=wss://your-domain.com
   # - ENABLE_SSL=true
   # - LETSENCRYPT_EMAIL=your-email@domain.com
   # - Generate secure secrets for DB_PASSWORD, SESSION_SECRET, etc.
   ```

2. **Point your domain's DNS A record to your server IP**

3. **Start services with SSL:**
   ```bash
   docker compose --profile express --profile ssl up -d
   ```

4. **Access your application at:** https://your-domain.com

#### Management Commands

```bash
./manage.sh install    # Interactive installation
./manage.sh upgrade    # Upgrade to latest version
./manage.sh backup     # Create database backup
./manage.sh restore    # Restore from backup
./manage.sh ssl        # Manage SSL certificates
./manage.sh status     # View service status
```

#### Deployment Modes

- **Express Mode** (default): All services bundled (PostgreSQL, Redis, MinIO)
  ```bash
  docker compose --profile express up -d
  ```

- **Advanced Mode**: Use external services (AWS S3, Azure Blob, external PostgreSQL)
  ```bash
  # Set DEPLOYMENT_MODE=advanced in .env
  docker compose up -d
  ```

**For complete deployment documentation**, see [DOCKER_SETUP.md](DOCKER_SETUP.md)

**Video Guide**: For a complete walkthrough of deploying Worklenz to a remote server, check out our [deployment video guide](https://www.youtube.com/watch?v=CAZGu2iOXQs&t=10s).

## Configuration

### Environment Variables

Worklenz uses a comprehensive environment configuration system. Copy `.env.example` to `.env` and configure according to your needs.

**Key Configuration Areas:**

- **Deployment Mode**: `express` (all services bundled) or `advanced` (external services)
- **Domain & URLs**: Configure for localhost or production domain
- **Database**: PostgreSQL credentials and connection settings
- **Security Secrets**: Session, cookie, and JWT secrets (auto-generated by setup scripts)
- **Storage**: MinIO (default), AWS S3, or Azure Blob Storage
- **Redis**: Cache configuration (Express mode)
- **SSL/TLS**: Let's Encrypt for production, self-signed for localhost
- **Backups**: Automated backup retention settings
- **Optional Features**: Google OAuth, reCAPTCHA, email notifications

**Quick Configuration:**

```bash
# Auto-generate all secrets and configure based on domain
./manage.sh auto-configure

# Or manually generate secrets
openssl rand -hex 32  # Use for SESSION_SECRET, COOKIE_SECRET, JWT_SECRET
```

**Important Variables:**

- `DOMAIN`: Your domain (localhost for local testing)
- `DEPLOYMENT_MODE`: express or advanced
- `STORAGE_PROVIDER`: s3 (MinIO/AWS) or azure
- `ENABLE_SSL`: true/false for SSL/TLS
- `BACKUP_RETENTION_DAYS`: Days to keep backups (default: 30)

For a complete list of variables with detailed documentation, see `.env.example`.

## MinIO Integration

The project uses MinIO as an S3-compatible object storage service, which provides an open-source alternative to AWS S3 for development and production.

### Working with MinIO

MinIO provides an S3-compatible API, so any code that works with S3 will work with MinIO by simply changing the endpoint URL. The backend has been configured to use MinIO by default, with no additional configuration required.

- **MinIO Console**: http://localhost:9001
  - Username: minioadmin
  - Password: minioadmin

- **Default Bucket**: worklenz-bucket (created automatically when the containers start)

### Backend Storage Configuration

The backend is pre-configured to use MinIO with the following settings:

```javascript
// S3 credentials with MinIO defaults
export const REGION = process.env.AWS_REGION || "us-east-1";
export const BUCKET = process.env.AWS_BUCKET || "worklenz-bucket";
export const S3_URL = process.env.S3_URL || "http://minio:9000/worklenz-bucket";
export const S3_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "minioadmin";
export const S3_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "minioadmin";
```

### Security Features

The new Docker setup includes enterprise-grade security features:

**Built-in Security:**
- ✅ Non-root containers (all services run as non-privileged users)
- ✅ Network isolation (backend network is internal-only)
- ✅ SSL/TLS support (Let's Encrypt for production, self-signed for localhost)
- ✅ Rate limiting on API and login endpoints
- ✅ Security headers (HSTS, CSP, X-Frame-Options, etc.)
- ✅ Auto-generated secure secrets (using `openssl rand -hex 32`)

**Best Practices for Production:**

1. **Use the automated setup** to generate strong, unique passwords and keys
2. **Never commit `.env` files** to version control
3. **Enable SSL/TLS** for production deployments (`ENABLE_SSL=true`)
4. **Configure automated backups** with appropriate retention
5. **Review and update** dependencies regularly
6. **Use strong passwords** for all services (DB, Redis, MinIO)
7. **Restrict network access** using firewall rules
8. **Monitor logs** regularly using `./manage.sh logs`

**Automated Backups:**
```bash
# Enable automated daily backups
docker compose --profile express --profile backup up -d

# Manual backup
./manage.sh backup

# Restore from backup
./manage.sh restore
```

## Security

If you believe you have found a security vulnerability in Worklenz, we encourage you to responsibly disclose this and not open a public issue. We will investigate all legitimate reports.

Email [info@worklenz.com](mailto:info@worklenz.com) to disclose any security vulnerabilities.

## Analytics

Worklenz uses Google Analytics to understand how the application is being used. This helps us improve the application and make better decisions about future development.

### What We Track
- Anonymous usage statistics
- Page views and navigation patterns
- Feature usage
- Browser and device information

### Privacy
- Analytics is opt-in only
- No personal information is collected
- Users can opt-out at any time
- Data is stored according to Google's privacy policy

### How to Opt-Out
If you've previously opted in and want to opt-out:
1. Clear your browser's local storage for the Worklenz domain
2. Or click the "Decline" button in the analytics notice if it appears

## Screenshots

<p align="center">
  <a href="https://worklenz.com/features/task-management/" target="_blank">
    <img
      src="https://worklenz.s3.amazonaws.com/assets/screenshots/task-views-view.png"
      alt="Worklenz task views"
      width="1024"
    />
  </a>
</p>
<p align="center">
  <a href="https://worklenz.com/features/time-tracking/" target="_blank">
    <img
      src="https://worklenz.s3.amazonaws.com/assets/screenshots/time-tracking-view.png"
      alt="Worklenz time tracking"
      width="1024"
    />
  </a>
</p>
<p align="center">
  <a href="https://worklenz.com/features/analytics/" target="_blank">
    <img
      src="https://worklenz.s3.amazonaws.com/assets/screenshots/analytics-view.png"
      alt="Worklenz analytics"
      width="1024"
    />
  </a>
</p>
<p align="center">
  <a href="https://worklenz.com/features/resource-management/" target="_blank">
    <img
      src="https://worklenz.s3.amazonaws.com/assets/screenshots/schedule-view.png"
      alt="Worklenz scheduler"
      width="1024"
    />
  </a>
</p>
<p align="center">
  <a href="https://worklenz.com/features/templates/" target="_blank">
    <img
      src="https://worklenz.s3.amazonaws.com/assets/screenshots/templates-view.png"
      alt="Worklenz templates"
      width="1024"
    />
  </a>
</p>

## Contributing

We welcome contributions from the community! If you'd like to contribute, please follow our [contributing guidelines](CONTRIBUTING.md).

## License

Worklenz is open source and released under the [GNU Affero General Public License Version 3 (AGPLv3)](LICENSE).

By contributing to Worklenz, you agree that your contributions will be licensed under its AGPL.

