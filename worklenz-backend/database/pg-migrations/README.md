# Node-pg-migrate Migrations

This directory contains database migrations managed by node-pg-migrate.

## Migration Commands

- `npm run migrate:create -- migration-name` - Create a new migration file
- `npm run migrate:up` - Run all pending migrations
- `npm run migrate:down` - Rollback the last migration
- `npm run migrate:redo` - Rollback and re-run the last migration

## Migration File Format

Migrations are JavaScript files with timestamp prefixes (e.g., `20250115000000_performance-indexes.js`).

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

The `pgmigrations` table tracks which migrations have been run. Do not modify this table manually.

## Converting from SQL Migrations

When converting SQL migrations to node-pg-migrate format:

1. Wrap SQL statements in `pgm.sql()` calls
2. Use node-pg-migrate helper methods where possible (createTable, addColumns, etc.)
3. Always include `IF EXISTS/IF NOT EXISTS` checks
4. Ensure proper rollback logic in the `down` function