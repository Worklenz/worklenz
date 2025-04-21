# Worklenz Backend

This is the Express.js backend for the Worklenz project management application.

## Getting Started

Follow these steps to set up the backend for development:

1. **Configure Environment Variables:**

   - Create a copy of the `.env.example` file and name it `.env`.
   - Update the required fields in `.env` with your specific configuration.

2. **Set up Database:**
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

3. **Install Dependencies:**

   ```bash
   npm install
   ```

4. **Run the Development Server:**

   ```bash
   npm run dev
   ```

   This starts the development server with hot reloading enabled.

5. **Build for Production:**

   ```bash
   npm run build
   ```

   This will compile the TypeScript code into JavaScript for production use.

6. **Start Production Server:**

   ```bash
   npm start
   ```

## API Documentation

The API endpoints are organized into logical controllers and follow RESTful design principles. The main API routes are prefixed with `/api/v1`.

### Authentication

Authentication is handled via JWT tokens. Protected routes require a valid token in the Authorization header.

### File Storage

The application supports both S3-compatible storage and Azure Blob Storage for file uploads. Configure your preferred storage option in the `.env` file.

## Development Guidelines

- Code should be written in TypeScript
- Follow the established patterns for controllers, services, and middlewares
- Add proper error handling for all API endpoints
- Write unit tests for critical functionality
- Document API endpoints with clear descriptions and examples

## Running Tests

```bash
npm test
```

## Docker Support

The backend can be run in a Docker container. See the main project README for Docker setup instructions.
