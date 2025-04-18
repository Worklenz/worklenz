#!/bin/bash
set -e

# This script controls the order of SQL file execution during database initialization
echo "Starting database initialization..."

# Check if we have SQL files in expected locations
if [ -f "/docker-entrypoint-initdb.d/sql/0_extensions.sql" ]; then
  SQL_DIR="/docker-entrypoint-initdb.d/sql"
  echo "Using SQL files from sql/ subdirectory"
elif [ -f "/docker-entrypoint-initdb.d/0_extensions.sql" ]; then
  # First time setup - move files to subdirectory
  echo "Moving SQL files to sql/ subdirectory..."
  mkdir -p /docker-entrypoint-initdb.d/sql
  
  # Move all SQL files (except this script) to the subdirectory
  for f in /docker-entrypoint-initdb.d/*.sql; do
    if [ -f "$f" ]; then
      cp "$f" /docker-entrypoint-initdb.d/sql/
      echo "Copied $f to sql/ subdirectory"
    fi
  done
  
  SQL_DIR="/docker-entrypoint-initdb.d/sql"
else
  echo "SQL files not found in expected locations!"
  exit 1
fi

# Execute SQL files in the correct order
echo "Executing 0_extensions.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_DIR/0_extensions.sql"

echo "Executing 1_tables.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_DIR/1_tables.sql"

echo "Executing indexes.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_DIR/indexes.sql"

echo "Executing 4_functions.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_DIR/4_functions.sql"

echo "Executing triggers.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_DIR/triggers.sql"

echo "Executing 3_views.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_DIR/3_views.sql"

echo "Executing 2_dml.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_DIR/2_dml.sql"

echo "Executing 5_database_user.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_DIR/5_database_user.sql"

echo "Database initialization completed successfully" 