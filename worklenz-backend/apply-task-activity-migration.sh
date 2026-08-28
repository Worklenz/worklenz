#!/bin/bash

# Apply Database Migration for Task Activity Logs Fix
# This script applies the migration to fix the CASCADE delete issue

echo "====================================="
echo "Task Activity Logs Migration"
echo "====================================="
echo ""
echo "This migration will:"
echo "  1. Allow task_id to be NULL in task_activity_logs"
echo "  2. Change foreign key constraint from CASCADE to SET NULL"
echo "  3. Preserve activity history when tasks are deleted"
echo ""

# Check if we're in the backend directory
if [ ! -d "database/migrations" ]; then
    echo "ERROR: Please run this script from the worklenz-backend directory"
    exit 1
fi

# Check for psql
if ! command -v psql &> /dev/null; then
    echo "ERROR: psql command not found. Please install PostgreSQL client tools."
    exit 1
fi

echo "Enter your database connection details:"
read -p "Database Host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Database Port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database Name (default: worklenz): " DB_NAME
DB_NAME=${DB_NAME:-worklenz}

read -p "Database User (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

echo ""
echo "Applying migration..."

MIGRATION_FILE="database/migrations/20260222000000-fix-task-activity-logs-cascade-delete.sql"

read -sp "Database Password: " PGPASSWORD
echo ""
export PGPASSWORD

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"; then
    echo ""
    echo "✓ Migration applied successfully!"
    echo ""
    echo "Changes made:"
    echo "  • task_activity_logs.task_id now allows NULL values"
    echo "  • Foreign key changed to ON DELETE SET NULL"
    echo "  • Activity logs will be preserved when tasks are deleted"
    echo "  • User 'Last Activity' will now update correctly on task deletion"
    echo ""
    echo "Next steps:"
    echo "  1. Restart the backend server"
    echo "  2. Test by creating and deleting a task"
    echo "  3. Verify Last Activity updates in Admin Center > Users"
    echo ""
else
    echo ""
    echo "✗ Migration failed!"
    echo ""
    echo "Common issues:"
    echo "  • Database connection failed - check credentials"
    echo "  • Migration already applied - check if constraint already exists"
    echo "  • Insufficient permissions - make sure user has ALTER TABLE rights"
fi

unset PGPASSWORD
