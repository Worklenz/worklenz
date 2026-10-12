# Node-pg-migrate Migrations

This directory contains database migrations managed by node-pg-migrate.

## Migration Commands

- `npm run migrate:create -- migration-name` - Create a new migration file
- `npm run migrate:up` - Run all pending migrations
- `npm run migrate:down` - Rollback the last migration
- `npm run migrate:redo` - Rollback and re-run the last migration
- `npm run migrate:bootstrap -- --before <unix-ms-id>` - Record converted historical migrations as applied, without recording a newer migration that must still run. Use only after a backup and review.

Migrations that create or replace PostgreSQL functions must run as the schema/function owner. Configure `MIGRATION_DB_USER` and `MIGRATION_DB_PASSWORD` (with optional host, port, and database overrides) when the normal application role is restricted; the `migrate:*` scripts use these values in preference to `DB_*`.

## Migration File Format

Migrations use **13-digit Unix-millisecond** timestamp prefixes (for example, `1736899200000_performance_indexes.js`). Create them with `npm run migrate:create -- migration-name`.

Do not use 14-digit calendar timestamps (`YYYYMMDDHHmmss`): node-pg-migrate does not recognize them. Never rename or backdate a deployed migration. Legacy-ID conversion requires a backup and a dry run of `npm run migrate:reconcile-legacy-ids`; use `-- --apply` only after review.

Each migration file exports two functions:
- `exports.up` - Contains the forward migration logic
- `exports.down` - Contains the rollback logic

## Best Practices

1. **Always use IF EXISTS/IF NOT EXISTS checks** to make migrations idempotent
2. **Test migrations locally** before deploying to production
3. **Include rollback logic** in the `down` function for all changes
4. **Use descriptive names** for migration files
5. **Keep migrations focused** - one logical change per migration

## Example Migration

```javascript
exports.up = pgm => {
  // Create table with IF NOT EXISTS
  pgm.createTable('users', {
    id: 'id',
    name: { type: 'varchar(100)', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  }, { ifNotExists: true });

  // Add index with IF NOT EXISTS
  pgm.createIndex('users', 'name', {
    name: 'idx_users_name',
    ifNotExists: true
  });
};

exports.down = pgm => {
  // Drop in reverse order
  pgm.dropIndex('users', 'name', { 
    name: 'idx_users_name', 
    ifExists: true 
  });
  
  pgm.dropTable('users', { ifExists: true });
};
```

## Migration History

The `pgmigrations` table tracks which migrations have been run. Do not modify this table manually. The sole exception is the reviewed `migrate:bootstrap` process for a historical conversion; it rebuilds this history and therefore requires a backup.

## Converting from SQL Migrations

When converting historical SQL migrations to node-pg-migrate format:

1. Preserve the original chronological Unix-millisecond ID; do not assign a new deployment-time ID.
2. Wrap SQL statements in `pgm.sql()` calls, or use node-pg-migrate helper methods where appropriate.
3. Keep the converted modules in `database/pg-migrations/`; do not recreate `database/migrations/`.
4. Bootstrap the historical IDs only after a backup, then run pending new migrations normally.
