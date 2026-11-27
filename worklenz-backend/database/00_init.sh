#!/bin/bash
set -e

echo "Starting database initialization..."

SQL_DIR="/docker-entrypoint-initdb.d/sql"
MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"
BACKUP_DIR="/docker-entrypoint-initdb.d/pg_backups"

# --------------------------------------------
# 🗄️ STEP 1: Attempt to restore latest backup
# --------------------------------------------

if [ -d "$BACKUP_DIR" ]; then
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -n 1)
else
  LATEST_BACKUP=""
fi

if [ -f "$LATEST_BACKUP" ]; then
  echo "🗄️ Found latest backup: $LATEST_BACKUP"
  echo "⏳ Restoring from backup..."
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$LATEST_BACKUP"
  echo "✅ Backup restoration complete. Skipping schema and migrations."
  exit 0
else
  echo "ℹ️ No valid backup found. Proceeding with base schema and migrations."
fi

# --------------------------------------------
# 🏗️ STEP 2: Continue with base schema setup
# --------------------------------------------

# Create migrations table if it doesn't exist
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT now()
  );
"

# List of base schema files to execute in order
BASE_SQL_FILES=(
  "0_extensions.sql"
  "1_tables.sql"
  "indexes.sql"
  "4_functions.sql"
  "triggers.sql"
  "3_views.sql"
  "2_dml.sql"
  "5_database_user.sql"
)

echo "Running base schema SQL files in order..."

for file in "${BASE_SQL_FILES[@]}"; do
  full_path="$SQL_DIR/$file"
  if [ -f "$full_path" ]; then
    echo "Executing $file..."
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$full_path"
  else
    echo "ERROR: required schema file $file not found." >&2
    exit 1
  fi
done

echo "✅ Base schema SQL execution complete."

# --------------------------------------------
# 🚀 STEP 3: Apply SQL migrations
# --------------------------------------------

if [ -d "$MIGRATIONS_DIR" ] && compgen -G "$MIGRATIONS_DIR/*.sql" > /dev/null; then
  echo "Applying migrations..."
  for f in "$MIGRATIONS_DIR"/*.sql; do
    version=$(basename "$f")
    if ! psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM schema_migrations WHERE version = '$version'" | grep -q 1; then
      echo "Applying migration: $version"
      psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO schema_migrations (version) VALUES ('$version');"
    else
      echo "Skipping already applied migration: $version"
    fi
  done
else
  echo "No migration files found or directory is empty, skipping migrations."
fi

# Only a fresh initialized schema is eligible to run migrations without history.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "CREATE TABLE public.worklenz_compose_fresh_install (id boolean PRIMARY KEY DEFAULT true CHECK (id)); INSERT INTO public.worklenz_compose_fresh_install DEFAULT VALUES;"

echo "🎉 Database initialization completed successfully."
