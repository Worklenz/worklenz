#!/bin/bash

# Update the root environment file used by Docker Compose.
# Usage: ./update-docker-env.sh [hostname] [use_ssl]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"
WORKLENZ_HOST="${1:-localhost}"
USE_SSL="${2:-false}"

if [ ! -f "$ENV_FILE" ]; then
  if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "Error: .env.example was not found in $SCRIPT_DIR" >&2
    exit 1
  fi
  cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

if [ "$USE_SSL" = "true" ]; then
  HTTP_PREFIX="https://"
  WS_PREFIX="wss://"
else
  HTTP_PREFIX="http://"
  WS_PREFIX="ws://"
fi

update_env_value() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

generate_secret_if_needed() {
  local key="$1"
  local current_value
  current_value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | head -n 1)"

  if [ -z "$current_value" ] || [[ "$current_value" == CHANGE_THIS* ]]; then
    update_env_value "$key" "$(openssl rand -hex 32)"
  fi
}

S3_BUCKET_VALUE="$(sed -n 's/^S3_BUCKET=//p' "$ENV_FILE" | head -n 1)"
S3_BUCKET_VALUE="${S3_BUCKET_VALUE:-worklenz-bucket}"
SEAWEEDFS_PORT_VALUE="$(sed -n 's/^SEAWEEDFS_S3_PORT=//p' "$ENV_FILE" | head -n 1)"
SEAWEEDFS_PORT_VALUE="${SEAWEEDFS_PORT_VALUE:-8333}"

update_env_value "DOMAIN" "$WORKLENZ_HOST"
update_env_value "VITE_API_URL" "${HTTP_PREFIX}${WORKLENZ_HOST}:3000"
update_env_value "VITE_SOCKET_URL" "${WS_PREFIX}${WORKLENZ_HOST}:3000"
update_env_value "FRONTEND_URL" "${HTTP_PREFIX}${WORKLENZ_HOST}:5000"
update_env_value "SERVER_CORS" "${HTTP_PREFIX}${WORKLENZ_HOST}:5000"
update_env_value "SOCKET_IO_CORS" "${HTTP_PREFIX}${WORKLENZ_HOST}:5000"
update_env_value "S3_ENDPOINT" "http://seaweedfs:8333"
update_env_value "S3_PUBLIC_URL" "${HTTP_PREFIX}${WORKLENZ_HOST}:${SEAWEEDFS_PORT_VALUE}/${S3_BUCKET_VALUE}"

generate_secret_if_needed "SESSION_SECRET"
generate_secret_if_needed "COOKIE_SECRET"
generate_secret_if_needed "JWT_SECRET"
generate_secret_if_needed "DB_PASSWORD"
generate_secret_if_needed "S3_SECRET_ACCESS_KEY"

rm -f "$ENV_FILE.bak"

echo "Environment configuration updated in $ENV_FILE"
echo "Frontend URL: ${HTTP_PREFIX}${WORKLENZ_HOST}:5000"
echo "API URL: ${HTTP_PREFIX}${WORKLENZ_HOST}:3000"
echo "SeaweedFS S3 URL: ${HTTP_PREFIX}${WORKLENZ_HOST}:${SEAWEEDFS_PORT_VALUE}/${S3_BUCKET_VALUE}"
