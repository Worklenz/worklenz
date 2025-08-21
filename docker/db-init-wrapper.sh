#!/bin/sh
set -e

# Install dos2unix if possible
if command -v apt-get >/dev/null 2>&1; then
  apt-get update && apt-get install -y dos2unix
elif command -v apk >/dev/null 2>&1; then
  apk add --no-cache dos2unix
fi

# Normalize and chmod all .sh files
for f in /docker-entrypoint-initdb.d/*.sh; do
  if [ -f "$f" ]; then
    dos2unix "$f" 2>/dev/null || true
    chmod +x "$f"
  fi
done

# hand control to the real entrypoint
exec docker-entrypoint.sh postgres

