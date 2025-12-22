#!/usr/bin/env bash
set -euo pipefail

# Runs base SQL and incremental migrations using psql.
# Requires env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (or PG* equivalents).

DB_HOST="${DB_HOST:-${PGHOST:-localhost}}"
DB_PORT="${DB_PORT:-${PGPORT:-5432}}"
DB_NAME="${DB_NAME:-${PGDATABASE:-worklenz_db}}"
DB_USER="${DB_USER:-${PGUSER:-postgres}}"
DB_PASS="${DB_PASSWORD:-${PGPASSWORD:-}}"

export PGPASSWORD="${DB_PASS}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DIR="${ROOT_DIR}/database/sql"
MIGRATIONS_DIR="${ROOT_DIR}/database/migrations"

run_file () {
  local file="$1"
  if [ -f "${file}" ]; then
    echo "Applying $(basename "${file}")..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${file}"
  else
    echo "WARNING: ${file} not found, skipping."
  fi
}

schema_initialized () {
  local result
  result="$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users' LIMIT 1;")"
  [ "${result}" = "1" ]
}

ensure_migrations_table () {
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c \
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"
}

is_migration_applied () {
  local filename="$1"
  local result
  result="$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
    "SELECT 1 FROM schema_migrations WHERE filename='${filename}' LIMIT 1;")"
  [ "${result}" = "1" ]
}

record_migration () {
  local filename="$1"
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c \
    "INSERT INTO schema_migrations (filename) VALUES ('${filename}') ON CONFLICT (filename) DO NOTHING;"
}

migrations_table_empty () {
  local result
  result="$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
    "SELECT 1 FROM schema_migrations LIMIT 1;")"
  [ -z "${result}" ]
}

BASE_SCHEMA_APPLIED="false"
if schema_initialized; then
  echo "Base schema already present, skipping base schema files."
else
  echo "Running base schema files..."
  run_file "${SQL_DIR}/0_extensions.sql"
  run_file "${SQL_DIR}/1_tables.sql"
  run_file "${SQL_DIR}/indexes.sql"
  run_file "${SQL_DIR}/4_functions.sql"
  run_file "${SQL_DIR}/triggers.sql"
  run_file "${SQL_DIR}/3_views.sql"
  run_file "${SQL_DIR}/2_dml.sql"
  run_file "${SQL_DIR}/5_database_user.sql"
  BASE_SCHEMA_APPLIED="true"
fi

if compgen -G "${MIGRATIONS_DIR}/*.sql" > /dev/null; then
  ensure_migrations_table
  baseline_mode="${MIGRATE_BASELINE:-auto}"
  if [ "${BASE_SCHEMA_APPLIED}" = "true" ]; then
    baseline_mode="true"
  elif [ "${baseline_mode}" = "auto" ] && migrations_table_empty; then
    baseline_mode="true"
    echo "schema_migrations is empty; baselining existing migrations."
    echo "Set MIGRATE_BASELINE=false to force executing all migrations."
  fi

  if [ "${baseline_mode}" = "true" ]; then
    echo "Baselining migrations; marking existing files as applied."
    for file in $(ls "${MIGRATIONS_DIR}"/*.sql | sort); do
      filename="$(basename "${file}")"
      record_migration "${filename}"
    done
  else
    echo "Running incremental migrations..."
    # Apply in sorted order
    for file in $(ls "${MIGRATIONS_DIR}"/*.sql | sort); do
      filename="$(basename "${file}")"
      if is_migration_applied "${filename}"; then
        echo "Skipping ${filename} (already applied)."
        continue
      fi

      run_file "${file}"
      record_migration "${filename}"
    done
  fi
else
  echo "No migrations/*.sql found, skipping."
fi

echo "Database migration completed."
