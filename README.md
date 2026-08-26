<div align="center">
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
    <a href="https://discord.com/invite/6Qmm839mgr">
        <img src="https://img.shields.io/discord/1202616582757556276?style=flat&logo=discord&logoColor=white&label=Discord&color=5865F2" alt="Discord">
    </a>
</p>

<p align="center">
    <a href="https://worklenz.com"><b>Website</b></a> •
    <a href="https://app.worklenz.com/auth/signup"><b>Sign in</b></a> •
    <a href="https://docs.worklenz.com/en/start/introduction/"><b>Documentation</b></a>
</p>

</div>

---
Meet [Worklenz](https://worklenz.com), a powerful, open-source project management platform built to help teams plan smarter, collaborate better, and ship faster. No bloated tools. No unnecessary complexity. Just everything your team needs, in one place. 🚀
> Worklenz is growing every day. Your bug reports, feature ideas, and feedback shape what we build next. Jump into [Discord](https://discord.com/invite/6Qmm839mgr) or open a GitHub issue - we read everything!


## 🚀 Getting Started

Pick the setup that works best for you:
<br>
### ☁️ Worklenz Cloud
The fastest way to get started - no setup, no infrastructure. Just sign up at [worklenz.com](https://worklenz.com) and start managing projects in minutes.

### 🖥️ Self-Host Worklenz
Prefer full control over your data? Run Worklenz on your own server.

| Method | Guide |
|--------|-------|
| 🐳 Docker (Recommended) | [Quick Docker Setup](#quick-start-docker) | 
| 🔧 Manual Installation | [Manual Dev Setup](#manual-installation) |

<br>

## 🌟 Features

- **🗺️ Project Management** - Plan, execute, and monitor projects from start to finish with full visibility across every stage.
- **📋 Task Management** - Break projects into tasks, set priorities, due dates, and track progress with multiple views (list, board, Gantt).
- **📐 Resource Planning** - Allocate the right people to the right tasks at the right time - keep your team balanced and productive.
- **👥 Team & Client Collaboration** - Bring your team and clients together in one shared space to align on goals, updates, and deliverables.
- **💰 Financial Insights** - Track budgets, costs, and financial performance across projects to keep spending on track and transparent.
- **⏱️ Time Tracking** - Log time directly on tasks to understand where your team's hours are actually going.
- **📊 Analytics & Reporting** - Get real-time insights into project health, team workload, and performance.
- **🗓️ Resource Management** - Plan team capacity, avoid overallocation, and schedule work with a visual scheduler.
- **🧩 Project Templates** - Start new projects in seconds using pre-built templates for common workflows.
- **🤝 Team Collaboration** - Comment on tasks, share files, and keep all communication in context - right where the work is.
- **📥 CSV Task Import** - Bulk-import tasks from any CSV file with intelligent column mapping and a pre-import preview.
<br><br>

### 📥 CSV Task Import

Import tasks in bulk from CSV files directly into any project. The import wizard guides you through uploading, mapping columns, previewing data, and creating tasks — all from the browser.

#### How to Use

1. Open a project and click the **⋮ menu** (top-right of the project header) → **Import Tasks**.
2. Select **CSV** as the import source and upload your `.csv` file (or download the sample template first).
3. **Map columns** — the wizard auto-matches common headers (e.g. *Task Name*, *Status*, *Assignee*, *Due Date*). You can adjust any mapping via the dropdown.
4. **Preview** — review the parsed data in a table before importing. Errors and warnings are highlighted.
5. Click **Import** to create the tasks inside the project.

#### Supported Fields

| CSV Column (auto-matched) | WorkLenz Field |
|---|---|
| Task Name, Title, Summary, Subject | **Task name** (required) |
| Status, State, Phase | **Status** |
| Assignee, Assigned To, Owner | **Assignees** |
| Due Date, Deadline, End Date | **Due date** |
| Start Date, Begin Date | **Start date** |
| Priority, Urgency, Severity | **Priority** |
| Description, Details, Notes | **Description** |
| Estimate, Story Points, Hours | **Estimation** |
| Label, Tags, Category | **Labels** |

Columns that don't match a built-in field are imported as **custom columns**.

#### Supported Date Formats

| Format | Example |
|---|---|
| ISO 8601 | `2026-08-21`, `2026-08-21T14:30:00Z` |
| US (MM/DD/YYYY) | `08/21/2026` |
| EU (DD/MM/YYYY) | `21/08/2026` |
| Natural | `21 Aug 2026`, `August 21, 2026` |
| Unix Timestamp | `1787443200` (seconds or milliseconds) |

#### Safety Limits

- **Max file size:** 10 MB
- **Max rows:** 5 000 tasks per import
- Binary files (PDF, PNG, ZIP, etc.) are rejected at upload

#### Delimiter Support

Comma (`,`), semicolon (`;`), and tab (`\t`) delimited files are all auto-detected.

#### Running Tests

```bash
cd worklenz-backend
npm test -- --testPathPattern="src/__tests__/csv-parser.test.ts"
```

The test suite covers date-strategy parsing, RFC 4180 tokenization, BOM handling, delimiter detection, binary rejection, and header auto-mapping (47 tests).
<br>

## 📸 Screenshots

<div align="center">

[![Task Management Task List View](https://tinyurl.com/2cd35sk2)](https://worklenz.com/task-management/)
_**Task Management Task List View**_

[![Task Management Kanban View](https://tinyurl.com/253o4fp7)](https://worklenz.com/task-management/)
_**Task Management Kanban View**_

[![Resource Management](https://tinyurl.com/228kgt26)](https://worklenz.com/resource-management/)
_**Resource Management**_

[![Projects & Tasks Templates](https://tinyurl.com/2are8yqt)](https://worklenz.com/project-templates/)
_**Projects & Tasks Templates**_

[![Time Tracking](https://tinyurl.com/28t2gryx)](https://worklenz.com/time-tracking/)
_**Time Tracking**_

[![Project Insights](https://tinyurl.com/23lxzxx9)](https://worklenz.com/analytics/)
_**Project Insights**_

[![Team Utilization](https://tinyurl.com/2xox9a9v)](https://worklenz.com/team-utilization/)
_**Team Utilization**_

[![Scheduler](https://tinyurl.com/239vjndh)](https://worklenz.com/timesheets/)
_**Scheduler**_

[![Project Profitability Monitor](https://tinyurl.com/2y4husx3)](https://worklenz.com/project-finance/)
_**Project Profitability Monitor**_

[![Client Portal](https://tinyurl.com/2yepbyt2)](https://worklenz.com/client-portal/)
_**Client Portal**_
</div>
<br>

## ⚙️ Tech Stack

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

| Layer | Technology |
|-------|-----------|
| **Frontend** | React + Ant Design |
| **Backend** | TypeScript + Express.js |
| **Database** | PostgreSQL |
| **Storage** | MinIO (S3-compatible) / AWS S3 / Azure Blob |
| **Cache** | Redis |
| **Proxy** | Nginx |

### Requirements

- Node.js version v18 or newer
- PostgreSQL version v15 or newer
- Docker and Docker Compose (for containerized setup)


## 📝 Documentation

Explore Worklenz's [product documentation](https://docs.worklenz.com/en/start/introduction/) to learn about features, setup, and usage and more.
<br>

<a id="quick-start-docker"></a>
### 🐳 Quick Start (Docker — Recommended)

The fastest way to get Worklenz running locally with all dependencies included. This setup includes **production-ready features** like nginx reverse proxy, SSL/TLS support, Redis caching, and automated backups.

**📋 Prerequisites:**
- Docker and Docker Compose installed on your system
- Git

**🪜 Steps:**

#### Option 1: Automated Setup (Easiest)
```bash
# 📥 Clone the repository
git clone https://github.com/Worklenz/worklenz.git
cd worklenz

# Run the automated setup script
./quick-setup.sh
```

This script will:
- ✅ Create `.env` file with auto-generated security secrets
- ✅ Configure URLs based on your domain (localhost or production)
- ✅ Set up SSL certificates (self-signed for localhost, Let's Encrypt for production)
- ✅ Install and start all services

#### Option 2: Manual Setup
```bash
# 📥 Clone the repository
git clone https://github.com/Worklenz/worklenz.git
cd worklenz

# 📄 Copy and configure environment file
cp .env.example .env
# Edit .env and set required values (DB_PASSWORD, SESSION_SECRET, etc.)

# ▶️ Start services (Express mode - includes PostgreSQL, Redis, MinIO)
docker compose --profile express up -d
```

**🌐 Access the application:**
- **Application**: https://localhost (or http://localhost)
- **MinIO Console**: http://localhost:9001 (login: minioadmin/minioadmin)

**🛠️ Management:**
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

<a id="manual-installation"></a>
### 🛠️ Manual Installation (For Development)

For developers who want to run the services individually or customize the setup.

**📋 Prerequisites:**
- Node.js (version 18 or higher)
- PostgreSQL (version 15 or higher)
- An S3-compatible storage service (like MinIO) or Azure Blob Storage

**🪜 Steps:**

1. 📥 Clone the repository:
```bash
git clone https://github.com/Worklenz/worklenz.git
cd worklenz
```

2. ⚙️ Set up environment variables:
```bash
cp worklenz-backend/.env.template worklenz-backend/.env
# Update the environment variables with your configuration
```

3. 📦 Install dependencies:
```bash
# Backend dependencies
cd worklenz-backend
npm install

# 🖥️ Frontend dependencies
cd ../worklenz-frontend
npm install
```

4. 🗄️ Set up the database:
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

5. ▶️ Start the development servers:
```bash
# Backend (single command for build, watch, and auto-restart)
cd worklenz-backend
npm run dev:all

# Frontend (in another terminal)
cd worklenz-frontend
npm run dev
```

6. 🌐 Access the application at http://localhost:5000

## 🚢 Deployment

### 🏠 Local Development

For local development, follow the [Quick Start (Docker)](#quick-start-docker) section above.

### 🌍 Production Deployment

The new Docker setup includes production-ready features for secure and scalable deployments.

#### ⚡ Quick Production Setup

```bash
# Clone and navigate to the repository
git clone https://github.com/Worklenz/worklenz.git
cd worklenz

# Run the automated setup
./quick-setup.sh
# When prompted, enter your production domain (e.g., worklenz.example.com)
# The script will configure SSL with Let's Encrypt automatically
```

#### 🔧 Manual Production Setup

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

#### 🛠️ Management Commands

```bash
./manage.sh install    # Interactive installation
./manage.sh upgrade    # Upgrade to latest version
./manage.sh backup     # Create database backup
./manage.sh restore    # Restore from backup
./manage.sh ssl        # Manage SSL certificates
./manage.sh status     # View service status
```

#### 🗂️ Deployment Modes

- 🟢 **Express Mode** (default): All services bundled (PostgreSQL, Redis, MinIO)
  ```bash
  docker compose --profile express up -d
  ```

- 🔵 **Advanced Mode**: Use external services (AWS S3, Azure Blob, external PostgreSQL)
  ```bash
  # Set DEPLOYMENT_MODE=advanced in .env
  docker compose up -d
  ```

**For complete deployment documentation**, see [DOCKER_SETUP.md](DOCKER_SETUP.md)

**Video Guide**: For a complete walkthrough of deploying Worklenz to a remote server, check out our [deployment video guide](https://www.youtube.com/watch?v=CAZGu2iOXQs&t=10s).

## ⚙️ Configuration

### Environment Variables

Worklenz uses a comprehensive environment configuration system. Copy `.env.example` to `.env` and configure according to your needs.

**📂 Key Configuration Areas:**

- **Deployment Mode**: `express` (all services bundled) or `advanced` (external services)
- **Domain & URLs**: Configure for localhost or production domain
- **Database**: PostgreSQL credentials and connection settings
- **Security Secrets**: Session, cookie, and JWT secrets (auto-generated by setup scripts)
- **Storage**: MinIO (default), AWS S3, or Azure Blob Storage
- **Redis**: Cache configuration (Express mode)
- **SSL/TLS**: Let's Encrypt for production, self-signed for localhost
- **Backups**: Automated backup retention settings
- **Optional Features**: Google OAuth, reCAPTCHA, email notifications

**⚡ Quick Configuration:**

```bash
# Auto-generate all secrets and configure based on domain
./manage.sh auto-configure

# Or manually generate secrets
openssl rand -hex 32  # Use for SESSION_SECRET, COOKIE_SECRET, JWT_SECRET
```

**📌 Important Variables:**

- `DOMAIN`: Your domain (localhost for local testing)
- `DEPLOYMENT_MODE`: express or advanced
- `STORAGE_PROVIDER`: s3 (MinIO/AWS) or azure
- `ENABLE_SSL`: true/false for SSL/TLS
- `BACKUP_RETENTION_DAYS`: Days to keep backups (default: 30)

For a complete list of variables with detailed documentation, see `.env.example`.

## 🪣 MinIO Integration

The project uses MinIO as an S3-compatible object storage service, which provides an open-source alternative to AWS S3 for development and production.

### 🔧 Working with MinIO

MinIO provides an S3-compatible API, so any code that works with S3 will work with MinIO by simply changing the endpoint URL. The backend has been configured to use MinIO by default, with no additional configuration required.

- **🖥️ MinIO Console**: http://localhost:9001
  - Username: minioadmin
  - Password: minioadmin

- **🪣 Default Bucket**: worklenz-bucket (created automatically when the containers start)

### 🛠️ Backend Storage Configuration

The backend is pre-configured to use MinIO with the following settings:

```javascript
// S3 credentials with MinIO defaults
export const REGION = process.env.AWS_REGION || "us-east-1";
export const BUCKET = process.env.AWS_BUCKET || "worklenz-bucket";
export const S3_URL = process.env.S3_URL || "http://minio:9000/worklenz-bucket";
export const S3_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "minioadmin";
export const S3_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "minioadmin";
```

## 🔒 Security

Worklenz is built with security in mind:

- 🔐 Non-root Docker containers
- 🌐 Network isolation (backend is internal-only)
- 🔑 SSL/TLS (Let's Encrypt for production, self-signed for localhost)
- 🛡️ Rate limiting on API and login endpoints
- 🔒 Security headers (HSTS, CSP, X-Frame-Options, etc.)
- 🗝️ Auto-generated secure secrets via `openssl rand -hex 32`

Found a security vulnerability? Please **do not** open a public issue. Email us at [info@worklenz.com](mailto:info@worklenz.com) instead. We take all legitimate reports seriously.
<br>

## 📈 Analytics

Worklenz uses Google Analytics to better understand how the application is used - helping us prioritize improvements and make smarter product decisions.

**What we track:**
- 📊 Anonymous usage statistics
- 🗺️ Page views and navigation patterns
- 🧩 Feature usage
- 💻 Browser and device information

**Your privacy matters:**
- 🔘 Analytics is **opt-in only** - we never collect data without your consent
- 🙈 No personal information is ever collected
- 🚪 You can **opt-out at any time** by clearing your browser's local storage for the Worklenz domain, or clicking "Decline" in the analytics notice
- 📜 Data is stored and handled according to [Google's Privacy Policy](https://policies.google.com/privacy)
<br/>

## 🤝 Contributing
We love contributions from the community! Here's how you can help:

- 🐛 [Report bugs](https://github.com/Worklenz/worklenz/issues/new)
- ✨ [Request features](https://github.com/Worklenz/worklenz/issues/new)
- 📖 Improve the documentation
- 💬 Share Worklenz with your team or write about it

Please read [CONTRIBUTING.md](https://github.com/Worklenz/worklenz/blob/main/CONTRIBUTING.md) before submitting a pull request.
<br>

## Contributors
Thanks to everyone who has contributed to Worklenz! 💙

[![Contributors](https://contrib.rocks/image?repo=Worklenz/worklenz)](https://github.com/Worklenz/worklenz/graphs/contributors)
<br>

## 💙 Community
Join the Worklenz community:

- 💬 [Discord Server](https://discord.gg/6Qmm839mgr) - chat with contributors and users
- 🐙 [GitHub Discussions](https://github.com/Worklenz/worklenz/discussions) - longer form conversations
- 🐦 Follow updates on our [website](https://worklenz.com)

We follow a [Code of Conduct](https://github.com/Worklenz/worklenz/blob/main/CODE_OF_CONDUCT.md) across all community spaces.
<br>

## 📄 License

Worklenz is open source, released under the [GNU Affero General Public License v3.0](https://github.com/Worklenz/worklenz/blob/main/LICENSE).

By contributing to Worklenz, you agree your contributions will be licensed under AGPL v3.0.
<br>

---
<br>
<div align="center">
  <strong>Built with 💙 by the Worklenz team and amazing contributors around the world.</strong>
  <br/>
  <a href="https://worklenz.com">www.worklenz.com</a>
</div>

