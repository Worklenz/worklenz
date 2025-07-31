<h1 align="center">
    <a href="https://worklenz.com" target="_blank" rel="noopener noreferrer">
        <img src="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/icon-144x144.png" alt="Worklenz Logo" width="75">
    </a>
    <br>
    Worklenz    
</h1>

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
</p>

<p align="center">
    <a href="https://worklenz.com/task-management/">Task Management</a> |
    <a href="https://worklenz.com/time-tracking/">Time Tracking</a> |
    <a href="https://worklenz.com/analytics/">Analytics</a> |
    <a href="https://worklenz.com/resource-management/">Resource Management</a> |
    <a href="https://worklenz.com/templates/">Project Templates</a>
</p>

<p align="center">
    <a href="https://worklenz.com" target="_blank">
      <img
        src="https://worklenz.s3.amazonaws.com/assets/screenshots/hero-view.png"
        alt="Worklenz"
        width="1200"
      />
    </a>
</p>

Worklenz is a project management tool designed to help organizations improve their efficiency. It provides a
comprehensive solution for managing projects, tasks, and collaboration within teams.

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

The fastest way to get Worklenz running locally with all dependencies included.

**Prerequisites:**
- Docker and Docker Compose installed on your system
- Git

**Steps:**

1. Clone the repository:
```bash
git clone https://github.com/Worklenz/worklenz.git
cd worklenz
```

2. Start the Docker containers:
```bash
docker-compose up -d
```

3. Access the application:
   - **Frontend**: http://localhost:5000
   - **Backend API**: http://localhost:3000
   - **MinIO Console**: http://localhost:9001 (login: minioadmin/minioadmin)

4. To stop the services:
```bash
docker-compose down
```

**Alternative startup methods:**
- **Windows**: Run `start.bat`
- **Linux/macOS**: Run `./start.sh`

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
# Terminal 1: Start the backend
cd worklenz-backend
npm run dev

# Terminal 2: Start the frontend
cd worklenz-frontend
npm run dev
```

6. Access the application at http://localhost:5000

## Deployment

For local development, follow the [Quick Start (Docker)](#-quick-start-docker---recommended) section above.

### Remote Server Deployment

When deploying to a remote server:

1. Set up the environment files with your server's hostname:
   ```bash
   # For HTTP/WS
   ./update-docker-env.sh your-server-hostname
   
   # For HTTPS/WSS
   ./update-docker-env.sh your-server-hostname true
   ```

2. Pull and run the latest Docker images:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

3. Access the application through your server's hostname:
   - Frontend: http://your-server-hostname:5000
   - Backend API: http://your-server-hostname:3000

4. **Video Guide**: For a complete walkthrough of deploying Worklenz to a remote server, check out our [deployment video guide](https://www.youtube.com/watch?v=CAZGu2iOXQs&t=10s).

## Configuration

### Environment Variables

Worklenz requires several environment variables to be configured for proper operation. These include:

- Database credentials
- Session secrets
- Storage configuration (S3 or Azure)
- Authentication settings

Please refer to the `.env.example` files for a full list of required variables.

The Docker setup uses environment variables to configure the services:

- **Frontend:**
  - `VITE_API_URL`: URL of the backend API (default: http://backend:3000 for container networking)
  - `VITE_SOCKET_URL`: WebSocket URL for real-time communication (default: ws://backend:3000)

- **Backend:**
  - Database connection parameters
  - Storage configuration
  - Other backend settings

For custom configuration, edit the `.env` file or the `update-docker-env.sh` script.

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

### Security Considerations

For production deployments:

1. Use strong, unique passwords and keys for all services
2. Do not commit `.env` files to version control
3. Use a production-grade PostgreSQL setup with proper backup procedures
4. Enable HTTPS for all public endpoints
5. Review and update dependencies regularly

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

