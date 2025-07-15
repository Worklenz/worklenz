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

   ```bash
   npm run dev
   ```

   This starts the development server allowing you to work on the project.

7. **Run the Production Server:**

   **a. Build the project:**

   ```bash
   npm run build
   ```

   This will compile the TypeScript code into JavaScript for production use.

   **b. Start the production server:**

   ```bash
   npm start
   ```

## Docker Setup (Alternative)

For an easier setup, you can use Docker and Docker Compose:

1. Make sure you have Docker and Docker Compose installed on your system.

2. From the root directory, run:

   ```bash
   docker-compose up -d
   ```

3. Access the application:
   - Frontend: http://localhost:5000 (Docker production build)
   - Backend API: http://localhost:3000
   - MinIO Console: http://localhost:9001 (login with minioadmin/minioadmin)

4. To stop the services:

   ```bash
   docker-compose down
   ```
