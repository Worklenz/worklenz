#!/bin/bash
# Database initialization wrapper script
# This script is run by PostgreSQL container on first startup
# Based on Worklenz's database initialization process

set -e

echo "========================================="
echo "Worklenz Database Initialization"
echo "========================================="

# Database directory
DB_DIR="/database/sql"
BACKUP_DIR="/pg_backups"

# Check if database is already initialized
if [ -f "/var/lib/postgresql/data/.initialized" ]; then
    echo "Database already initialized. Skipping..."
    exit 0
fi

# Check for existing backup to restore
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "worklenz_backup_*.sql.gz" 2>/dev/null | sort -r | head -n 1)

if [ -n "$LATEST_BACKUP" ] && [ -f "$LATEST_BACKUP" ]; then
    echo "Found existing backup: $LATEST_BACKUP"
    echo "Restoring from backup..."

    gunzip -c "$LATEST_BACKUP" | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

    if [ $? -eq 0 ]; then
        echo "✓ Database restored successfully from backup"
        touch "/var/lib/postgresql/data/.initialized"
        exit 0
    else
        echo "⚠ Backup restore failed, initializing from schema..."
    fi
fi

# No backup found or restore failed, initialize from schema
echo "Initializing database from schema files..."

# Function to execute SQL file
execute_sql() {
    local file=$1
    local description=$2

    if [ ! -f "$file" ]; then
        echo "⚠ Warning: $description file not found: $file"
        return 1
    fi

    echo "→ Executing $description..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$file"

    if [ $? -eq 0 ]; then
        echo "✓ $description completed"
        return 0
    else
        echo "✗ $description failed"
        return 1
    fi
}

# Initialize schema in correct order (based on Worklenz's 00_init.sh)
echo ""
echo "Step 1: Installing PostgreSQL extensions..."
execute_sql "$DB_DIR/0_extensions.sql" "Extensions"

echo ""
echo "Step 2: Creating database tables..."
execute_sql "$DB_DIR/1_tables.sql" "Tables"

echo ""
echo "Step 3: Creating indexes..."
execute_sql "$DB_DIR/indexes.sql" "Indexes"

echo ""
echo "Step 4: Creating functions and stored procedures..."
execute_sql "$DB_DIR/4_functions.sql" "Functions"

echo ""
echo "Step 5: Creating triggers..."
execute_sql "$DB_DIR/triggers.sql" "Triggers"

echo ""
echo "Step 6: Creating views..."
execute_sql "$DB_DIR/3_views.sql" "Views"

echo ""
echo "Step 7: Inserting initial data..."
execute_sql "$DB_DIR/2_dml.sql" "Initial Data"

echo ""
echo "Step 8: Setting up database user..."
execute_sql "$DB_DIR/5_database_user.sql" "Database User"

# Run migrations if directory exists
if [ -d "$DB_DIR/migrations" ]; then
    echo ""
    echo "Step 9: Running database migrations..."

    # Create migrations tracking table if it doesn't exist
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" << EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF

    # Run each migration file in order
    for migration_file in "$DB_DIR/migrations"/*.sql; do
        if [ -f "$migration_file" ]; then
            migration_name=$(basename "$migration_file")

            # Check if migration was already applied
            already_applied=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
                "SELECT COUNT(*) FROM schema_migrations WHERE migration_name='$migration_name';" | tr -d ' ')

            if [ "$already_applied" -eq "0" ]; then
                echo "→ Applying migration: $migration_name"
                psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$migration_file"

                if [ $? -eq 0 ]; then
                    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
                        "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name');"
                    echo "✓ Migration applied: $migration_name"
                else
                    echo "✗ Migration failed: $migration_name"
                fi
            else
                echo "↷ Migration already applied: $migration_name"
            fi
        fi
    done
fi

# Mark database as initialized
touch "/var/lib/postgresql/data/.initialized"

echo ""
echo "========================================="
echo "✓ Database initialization completed!"
echo "========================================="
