#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

DB_HOST="${DB_HOST:-${PGHOST:-localhost}}"
DB_PORT="${DB_PORT:-${PGPORT:-5432}}"
DB_NAME="${DB_NAME:-${PGDATABASE:-worklenz_db}}"
DB_USER="${DB_USER:-${PGUSER:-postgres}}"

wait_for_db () {
  local timeout="${DB_MIGRATE_WAIT_SECONDS:-30}"
  if ! [[ "${timeout}" =~ ^[0-9]+$ ]]; then
    timeout=30
  fi

  local start_time
  start_time="$(date +%s)"

  while true; do
    if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1; then
      return 0
    fi

    if [ $(( $(date +%s) - start_time )) -ge "${timeout}" ]; then
      echo "Database is not ready after ${timeout}s."
      return 1
    fi

    sleep 2
  done
}

if [ "${SKIP_DB_MIGRATE:-}" != "true" ]; then
  if command -v pg_isready > /dev/null 2>&1; then
    wait_for_db
  else
    echo "pg_isready not found; skipping DB readiness check."
  fi

  echo "Running database migrations..."
  bash scripts/db-migrate.sh
else
  echo "Skipping database migrations (SKIP_DB_MIGRATE=true)."
fi

exec "$@"