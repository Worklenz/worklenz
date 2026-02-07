# Setting up development environment

Getting started with development is a breeze! Follow these steps and you'll be contributing in no time.

## Requirements

- Node.js version v20 or newer - [Node.js](https://nodejs.org/en/download/)
- PostgreSQL version v15 or newer - [PostgreSQL](https://www.postgresql.org/download/)
- S3-compatible storage (like MinIO) for file storage

## Prerequisites

- `$ npm install -g typescript` (optional, but recommended)

## Installation
**Clone the repository:**

   ```bash
   git clone https://github.com/Worklenz/worklenz.git
   cd worklenz
   ```

### Frontend installation

1. **Navigate to the frontend project directory:**

   ```bash
   cd worklenz-frontend
   ```
2. **Install dependencies:**

   ```bash
   npm install
   ```
   
3. **Run the frontend:**
   ```bash
   npm start
   ```
   
4. Navigate to [http://localhost:5173](http://localhost:5173) (development server)

### Backend installation
   
1. **Navigate to the backend project directory:**

   ```bash
   cd worklenz-backend
   ```

2. **Open your IDE:**

   Open the project directory in your preferred code editor or IDE like Visual Studio Code.

3. **Configure Environment Variables:**

   - Create a copy of the `.env.example` file and name it `.env`.
   - Update the required fields in `.env` with your specific configuration.

4. **Set up Database**
   - Create a new database named `worklenz_db` on your local PostgreSQL server. 
   - Update the database connection details in your `.env` file.
   - Execute the SQL setup files in the correct order:
   
   ```bash
   # From your PostgreSQL client or command line
   psql -U your_username -d worklenz_db -f database/sql/0_extensions.sql
   psql -U your_username -d worklenz_db -f database/sql/1_tables.sql
   psql -U your_username -d worklenz_db -f database/sql/indexes.sql
   psql -U your_username -d worklenz_db -f database/sql/4_functions.sql
   psql -U your_username -d worklenz_db -f database/sql/triggers.sql
   psql -U your_username -d worklenz_db -f database/sql/3_views.sql
   psql -U your_username -d worklenz_db -f database/sql/2_dml.sql
   psql -U your_username -d worklenz_db -f database/sql/5_database_user.sql
   ```
   
   Alternatively, you can use the provided shell script:
   
   ```bash
   # Make sure the script is executable
   chmod +x database/00-init-db.sh
   # Run the script (may need modifications for local execution)
   ./database/00-init-db.sh
   ```

5. **Install Dependencies:**

   ```bash
   npm install
   ```

6. **Run the Development Server:**

   **Option 1: Combined development mode (Recommended)**
   
   ```bash
   npm run dev:all
   ```
   
   This single command runs both the build watch process and the server with auto-restart. No need to run `npm run dev` and `npm start` separately.

   **Option 2: Separate commands**
   
   ```bash
   # Terminal 1: Build and watch for changes
   npm run dev
   
   # Terminal 2: Start the server
   npm start
   ```

   The first option (`npm run dev:all`) is recommended as it simplifies the development workflow.

## Docker Setup (Alternative - Recommended for Quick Start)

For an easier setup with production-ready features, use the new Docker setup with automated scripts:

### Quick Start with Docker

**Option 1: Automated Setup (Easiest)**

```bash
# From the root directory, run the automated setup
./quick-setup.sh
```

This script will:
- Create `.env` file with auto-generated security secrets
- Configure URLs for localhost
- Set up SSL certificates (self-signed for localhost)
- Install and start all services (PostgreSQL, Redis, MinIO, nginx)

**Option 2: Manual Docker Setup**

```bash
# Copy environment configuration
cp .env.example .env
# Edit .env if needed (defaults work for localhost)

# Start services (Express mode - all services bundled)
docker compose --profile express up -d
```

### Access the Application

- **Application**: https://localhost (or http://localhost)
- **MinIO Console**: http://localhost:9001 (login: minioadmin/minioadmin)

### Management Commands

```bash
./manage.sh status    # View service status
./manage.sh logs      # View logs
./manage.sh stop      # Stop all services
./manage.sh start     # Start all services
./manage.sh backup    # Create database backup
./manage.sh restart   # Restart all services
```

### What's Included

The Docker setup now includes:
- ✅ Nginx reverse proxy with SSL/TLS support
- ✅ Redis caching for improved performance
- ✅ Automated database backups
- ✅ Health checks on all services
- ✅ Network isolation and security hardening
- ✅ Production-ready configuration

### For Complete Documentation

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for:
- Production deployment guide
- SSL/TLS configuration
- Backup and restore procedures
- Advanced configuration options
- Troubleshooting guide
