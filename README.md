<h1 align="center">
    <a href="https://worklenz.com" target="_blank" rel="noopener noreferrer">
        <img src="https://app.worklenz.com/assets/icons/icon-144x144.png" alt="Worklenz Logo" width="75">
    </a>
    <br>
    Worklenz    
</h1>

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

These instructions will help you set up and run the Worklenz project on your local machine for development and testing purposes.

### Prerequisites

- Node.js (version 18 or higher)
- PostgreSQL database
- An S3-compatible storage service (like MinIO) or Azure Blob Storage

### Option 1: Manual Installation

1. Clone the repository
```bash
git clone https://github.com/Worklenz/worklenz.git
cd worklenz
```

2. Set up environment variables
   - Copy the example environment files
   ```bash
   cp .env.example .env
   cp worklenz-backend/.env.example worklenz-backend/.env
   ```
   - Update the environment variables with your configuration

3. Install dependencies
```bash
# Install backend dependencies
cd worklenz-backend
npm install

# Install frontend dependencies
cd ../worklenz-frontend
npm install
```

4. Set up the database
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

5. Start the development servers
```bash
# In one terminal, start the backend
cd worklenz-backend
npm run dev

# In another terminal, start the frontend
cd worklenz-frontend
npm run dev
```

6. Access the application at http://localhost:5000

### Option 2: Docker Setup

The project includes a fully configured Docker setup with:
- Frontend React application
- Backend server
- PostgreSQL database
- MinIO for S3-compatible storage

1. Clone the repository:
```bash
git clone https://github.com/Worklenz/worklenz.git
cd worklenz
```

2. Start the Docker containers (choose one option):

**Using Docker Compose directly**
```bash
docker-compose up -d
```

3. The application will be available at:
   - Frontend: http://localhost:5000
   - Backend API: http://localhost:3000
   - MinIO Console: http://localhost:9001 (login with minioadmin/minioadmin)

4. To stop the services:
```bash
docker-compose down
```

## Configuration

### Environment Variables

Worklenz requires several environment variables to be configured for proper operation. These include:

- Database credentials
- Session secrets
- Storage configuration (S3 or Azure)
- Authentication settings

Please refer to the `.env.example` files for a full list of required variables.

### MinIO Integration

The project uses MinIO as an S3-compatible object storage service, which provides an open-source alternative to AWS S3 for development and production.

- **MinIO Console**: http://localhost:9001
  - Username: minioadmin
  - Password: minioadmin

- **Default Bucket**: worklenz-bucket (created automatically when the containers start)

### Security Considerations

For production deployments:

1. Use strong, unique passwords and keys for all services
2. Do not commit `.env` files to version control
3. Use a production-grade PostgreSQL setup with proper backup procedures
4. Enable HTTPS for all public endpoints
5. Review and update dependencies regularly

## Contributing

We welcome contributions from the community! If you'd like to contribute, please follow our [contributing guidelines](CONTRIBUTING.md).

## Security

If you believe you have found a security vulnerability in Worklenz, we encourage you to responsibly disclose this and not open a public issue. We will investigate all legitimate reports.

Email [info@worklenz.com](mailto:info@worklenz.com) to disclose any security vulnerabilities.

## License

This project is licensed under the [MIT License](LICENSE).

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

### Contributing

We welcome contributions from the community! If you'd like to contribute, please follow
our [contributing guidelines](CONTRIBUTING.md).

### License

Worklenz is open source and released under the [GNU Affero General Public License Version 3 (AGPLv3)](LICENSE).

By contributing to Worklenz, you agree that your contributions will be licensed under its AGPL.

# Worklenz React

This repository contains the React version of Worklenz with a Docker setup for easy development and deployment.

## Getting Started with Docker

The project includes a fully configured Docker setup with:
- Frontend React application
- Backend server
- PostgreSQL database
- MinIO for S3-compatible storage

### Prerequisites

- Docker and Docker Compose installed on your system
- Git

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/Worklenz/worklenz.git
cd worklenz
```

2. Start the Docker containers (choose one option):

**Option 1: Using the provided scripts (easiest)**
- On Windows:
  ```
  start.bat
  ```
- On Linux/macOS:
  ```bash
  ./start.sh
  ```

**Option 2: Using Docker Compose directly**
```bash
docker-compose up -d
```

3. The application will be available at:
   - Frontend: http://localhost:5000
   - Backend API: http://localhost:3000
   - MinIO Console: http://localhost:9001 (login with minioadmin/minioadmin)

4. To stop the services (choose one option):

**Option 1: Using the provided scripts**
- On Windows:
  ```
  stop.bat
  ```
- On Linux/macOS:
  ```bash
  ./stop.sh
  ```

**Option 2: Using Docker Compose directly**
```bash
docker-compose down
```

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

The S3 client is initialized with special MinIO configuration:

```javascript
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID || "",
    secretAccessKey: S3_SECRET_ACCESS_KEY || "",
  },
  endpoint: getEndpointFromUrl(), // Extracts endpoint from S3_URL
  forcePathStyle: true, // Required for MinIO
});
```

### Environment Configuration

The project uses the following environment file structure:

- **Frontend**:
  - `worklenz-frontend/.env.development` - Development environment variables
  - `worklenz-frontend/.env.production` - Production build variables
  
- **Backend**:
  - `worklenz-backend/.env` - Backend environment variables

### Setting Up Environment Files

The Docker environment script will create or overwrite all environment files:

```bash
# For HTTP/WS
./update-docker-env.sh your-hostname

# For HTTPS/WSS
./update-docker-env.sh your-hostname true
```

This script generates properly configured environment files for both development and production environments.

## Docker Deployment

### Local Development with Docker

1. Set up the environment files:
   ```bash
   # For HTTP/WS
   ./update-docker-env.sh
   
   # For HTTPS/WSS
   ./update-docker-env.sh localhost true
   ```

2. Run the application using Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. Access the application:
   - Frontend: http://localhost:5000
   - Backend API: http://localhost:3000 (or https://localhost:3000 with SSL)

### Remote Server Deployment

When deploying to a remote server:

1. Set up the environment files with your server's hostname:
   ```bash
   # For HTTP/WS
   ./update-docker-env.sh your-server-hostname
   
   # For HTTPS/WSS
   ./update-docker-env.sh your-server-hostname true
   ```
   
   This ensures that the frontend correctly connects to the backend API.

2. Pull and run the latest Docker images:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

3. Access the application through your server's hostname:
   - Frontend: http://your-server-hostname:5000
   - Backend API: http://your-server-hostname:3000

### Environment Configuration

The Docker setup uses environment variables to configure the services:

- Frontend:
  - `VITE_API_URL`: URL of the backend API (default: http://backend:3000 for container networking)
  - `VITE_SOCKET_URL`: WebSocket URL for real-time communication (default: ws://backend:3000)

- Backend:
  - Database connection parameters
  - Storage configuration
  - Other backend settings

For custom configuration, edit the `.env` file or the `update-docker-env.sh` script.

