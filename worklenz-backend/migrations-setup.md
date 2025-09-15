# Node-pg-migrate Setup for Worklenz

## Installation

```bash
npm install --save node-pg-migrate
npm install --save-dev @types/node-pg-migrate
```

## Configuration

### 1. Add to package.json scripts:

```json
{
  "scripts": {
    "migrate": "node-pg-migrate",
    "migrate:up": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down",
    "migrate:create": "node-pg-migrate create",
    "migrate:redo": "node-pg-migrate redo"
  }
}
```

### 2. Create migration config (.pgmrc or migrations/config.js):

```javascript
// migrations/config.js
module.exports = {
  databaseUrl: process.env.DATABASE_URL || {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  migrationsTable: 'pgmigrations',
  dir: 'migrations',
  direction: 'up',
  count: undefined,
  schema: 'public',
  createSchema: false,
  checkOrder: true,
  migrationFilenameFormat: 'utc',
  templateFileName: 'migration-template.ts'
};
```

## Migration Structure

### Initial Migration Plan (Convert existing SQL files):

1. **001_extensions.ts** - Enable required extensions
2. **002_domains_and_types.ts** - Create custom domains and enum types
3. **003_core_tables.ts** - User, organization, and authentication tables
4. **004_project_tables.ts** - Project management tables
5. **005_task_tables.ts** - Task management tables
6. **006_indexes.ts** - Create all indexes
7. **007_functions.ts** - Stored procedures and functions
8. **008_triggers.ts** - Database triggers
9. **009_views.ts** - Database views
10. **010_initial_data.ts** - Seed data

### Example Migration File:

```typescript
// migrations/001_extensions.ts
import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('uuid-ossp', { ifNotExists: true });
  pgm.createExtension('pg_trgm', { ifNotExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropExtension('pg_trgm', { ifExists: true });
  pgm.dropExtension('uuid-ossp', { ifExists: true });
}
```

### Complex Migration Example (Tables with relations):

```typescript
// migrations/003_core_tables.ts
import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create custom domain
  pgm.createDomain('wl_email', 'text', {
    check: "value ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'"
  });

  // Create enum type
  pgm.createType('language_type', ['en', 'es', 'pt', 'alb', 'de', 'zh_cn', 'ko']);

  // Create users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      default: pgm.func('uuid_generate_v4()'),
      primaryKey: true,
      notNull: true
    },
    email: {
      type: 'wl_email',
      notNull: true,
      unique: true
    },
    name: {
      type: 'varchar(255)',
      notNull: true
    },
    password: {
      type: 'text'
    },
    language: {
      type: 'language_type',
      default: 'en'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Create index
  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'created_at');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('users');
  pgm.dropType('language_type');
  pgm.dropDomain('wl_email');
}
```

## Benefits for Worklenz

1. **Incremental Updates**: New features can be added as new migrations
2. **Team Collaboration**: Developers can see exactly what DB changes were made
3. **CI/CD Integration**: Migrations can run automatically in deployment pipelines
4. **Development Safety**: Rollback capabilities for development environments
5. **Migration History**: Clear audit trail of all database changes

## Migration Commands

```bash
# Create a new migration
npm run migrate:create my_new_feature

# Run all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Rollback and re-run last migration
npm run migrate:redo

# Run migrations up to specific version
npm run migrate:up 3

# Check migration status
npm run migrate -- status
```

## Transition Strategy

### Phase 1: Setup (Week 1)
1. Install node-pg-migrate
2. Create migration config
3. Test connection and setup

### Phase 2: Convert Existing Schema (Week 2-3)
1. Create baseline migration from current schema
2. Split large SQL files into logical migrations
3. Test migrations on fresh database

### Phase 3: Validation (Week 4)
1. Compare migrated schema with original
2. Run application tests
3. Document any differences

### Phase 4: Team Training & Rollout
1. Update documentation
2. Train team on migration workflow
3. Update CI/CD pipelines

## Best Practices

1. **Small, Focused Migrations**: Each migration should do one thing
2. **Always Include Down**: Make migrations reversible
3. **Test Migrations**: Run up and down in development before committing
4. **No Data Modifications in Schema Migrations**: Separate schema and data migrations
5. **Use Transactions**: Wrap migrations in transactions when possible
6. **Version Control**: Commit migrations with related code changes

## Handling Large Functions/Procedures

For the 269KB functions file, consider:

```typescript
// migrations/007_functions.ts
import { MigrationBuilder } from 'node-pg-migrate';
import * as fs from 'fs';
import * as path from 'path';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Read function definitions from separate SQL files
  const functionsDir = path.join(__dirname, 'sql', 'functions');
  const files = fs.readdirSync(functionsDir).sort();
  
  for (const file of files) {
    const sql = fs.readFileSync(path.join(functionsDir, file), 'utf8');
    pgm.sql(sql);
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop functions in reverse order
  // Or maintain a list of function names to drop
}
```

## Considerations

### Pros:
- Professional migration management
- Better for teams and production
- Supports complex deployment scenarios
- Industry standard approach

### Cons:
- Initial setup effort required
- Team learning curve
- Need to convert existing SQL files
- More complex than raw SQL for simple schemas

## Recommendation

Given Worklenz's complexity (100+ tables, 269KB of functions, multiple developers), implementing node-pg-migrate would provide:

1. **Better maintainability** for the growing schema
2. **Safer deployments** with rollback capabilities
3. **Clear change history** for debugging
4. **Easier onboarding** for new developers
5. **Professional-grade** database management

The initial investment in setup will pay dividends as the application grows and the team expands.