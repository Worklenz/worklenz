#!/bin/bash
set -eu

# Adjust these as needed:
CONTAINER=worklenz_db
DB_NAME=worklenz_db
DB_USER=postgres
BACKUP_DIR=./pg_backups
mkdir -p "$BACKUP_DIR"

timestamp=$(date +%Y-%m-%d_%H-%M-%S)
outfile="${BACKUP_DIR}/${DB_NAME}_${timestamp}.sql"
echo "Creating backup $outfile ..."

docker exec -t "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$outfile"
echo "Backup saved to $outfile"
