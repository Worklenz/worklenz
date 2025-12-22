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

echo "Running base schema files..."
run_file "${SQL_DIR}/0_extensions.sql"
run_file "${SQL_DIR}/1_tables.sql"
run_file "${SQL_DIR}/indexes.sql"
run_file "${SQL_DIR}/4_functions.sql"
run_file "${SQL_DIR}/triggers.sql"
run_file "${SQL_DIR}/3_views.sql"
run_file "${SQL_DIR}/2_dml.sql"
run_file "${SQL_DIR}/5_database_user.sql"

if compgen -G "${MIGRATIONS_DIR}/*.sql" > /dev/null; then
  echo "Running incremental migrations..."
  # Apply in sorted order
  for file in $(ls "${MIGRATIONS_DIR}"/*.sql | sort); do
    run_file "${file}"
  done
else
  echo "No migrations/*.sql found, skipping."
fi

echo "Database migration completed."
