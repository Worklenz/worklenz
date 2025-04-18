All database DDLs, DMLs and migrations relates to the application should be stored here as well.

# Worklenz Database

## Directory Structure

- `sql/` - Contains all SQL files needed for database initialization
- `migrations/` - Contains database migration scripts
- `00-init-db.sh` - Initialization script that executes SQL files in the correct order

## SQL File Execution Order

The database initialization files should be executed in the following order:

1. `sql/0_extensions.sql` - PostgreSQL extensions
2. `sql/1_tables.sql` - Table definitions and constraints
3. `sql/indexes.sql` - All database indexes 
4. `sql/4_functions.sql` - Database functions
5. `sql/triggers.sql` - Database triggers
6. `sql/3_views.sql` - Database views
7. `sql/2_dml.sql` - Data Manipulation Language statements (inserts, updates)
8. `sql/5_database_user.sql` - Database user setup

## Docker-based Setup

In the Docker environment, we use a shell script called `00-init-db.sh` to control the SQL file execution order:

1. The shell script creates a `sql/` subdirectory if it doesn't exist
2. It copies all .sql files into this subdirectory
3. It executes the SQL files from the subdirectory in the correct order

This approach prevents the SQL files from being executed twice by Docker's automatic initialization mechanism, which would cause errors for objects that already exist.

## Manual Setup

If you're setting up the database manually, please follow the execution order listed above. Ensure your SQL files are in the `sql/` subdirectory before executing the script.
