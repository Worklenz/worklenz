#!/bin/bash
set -e

echo "Starting database initialization..."

SQL_DIR="/docker-entrypoint-initdb.d/sql"
MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"
BUSINESS_MIGRATIONS_DIR="${BUSINESS_MIGRATIONS_DIR:-}"
BUSINESS_SCHEMA_FILE="${BUSINESS_SCHEMA_FILE:-}"
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
    echo "WARNING: $file not found, skipping."
  fi
done

echo "✅ Base schema SQL execution complete."

if [ -n "$BUSINESS_SCHEMA_FILE" ] && [ -f "$BUSINESS_SCHEMA_FILE" ]; then
  echo "Executing Business Edition schema: $(basename "$BUSINESS_SCHEMA_FILE")..."
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$BUSINESS_SCHEMA_FILE"
fi

# --------------------------------------------
# 🚀 STEP 3: Apply SQL migrations
# --------------------------------------------

if [ -d "$MIGRATIONS_DIR" ] && compgen -G "$MIGRATIONS_DIR/*.sql" > /dev/null; then
  echo "Applying migrations..."
  for f in "$MIGRATIONS_DIR"/*.sql; do
    version=$(basename "$f")
    if ! psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM schema_migrations WHERE version = '$version'" | grep -q 1; then
      echo "Applying migration: $version"
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO schema_migrations (version) VALUES ('$version');"
    else
      echo "Skipping already applied migration: $version"
    fi
  done
else
  echo "No migration files found or directory is empty, skipping migrations."
fi

if [ -n "$BUSINESS_MIGRATIONS_DIR" ] && [ -d "$BUSINESS_MIGRATIONS_DIR" ] && compgen -G "$BUSINESS_MIGRATIONS_DIR/*.sql" > /dev/null; then
  echo "Applying Business Edition migrations..."
  for f in "$BUSINESS_MIGRATIONS_DIR"/*.sql; do
    version="business/$(basename "$f")"
    if ! psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM schema_migrations WHERE version = '$version'" | grep -q 1; then
      echo "Applying Business migration: $(basename "$f")"
      psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO schema_migrations (version) VALUES ('$version');"
    else
      echo "Skipping already applied Business migration: $(basename "$f")"
    fi
  done
fi

echo "🎉 Database initialization completed successfully."
