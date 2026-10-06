#!/usr/bin/env node
'use strict';

// Loads .env and runs node-pg-migrate with DATABASE_URL built from DB_* vars.
// Usage: node scripts/migrate.js <up|down|create> [args...]

require('dotenv').config();

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT = '5432',
  DB_NAME,
  MIGRATION_DB_USER,
  MIGRATION_DB_PASSWORD,
  MIGRATION_DB_HOST,
  MIGRATION_DB_PORT,
  MIGRATION_DB_NAME,
} = process.env;

const migrationDbUser = MIGRATION_DB_USER || DB_USER;
const migrationDbPassword = MIGRATION_DB_PASSWORD ?? DB_PASSWORD;
const migrationDbHost = MIGRATION_DB_HOST || DB_HOST || 'localhost';
const migrationDbPort = MIGRATION_DB_PORT || DB_PORT;
const migrationDbName = MIGRATION_DB_NAME || DB_NAME;

if (!migrationDbUser || !migrationDbName) {
  console.error('Missing migration database credentials (MIGRATION_DB_USER/DB_USER and MIGRATION_DB_NAME/DB_NAME).');
  process.exit(1);
}

const databaseUrl = `postgresql://${migrationDbUser}:${encodeURIComponent(migrationDbPassword || '')}@${migrationDbHost}:${migrationDbPort}/${migrationDbName}`;

// Invoke the underlying JS entrypoint directly with `node` rather than the
// .bin/node-pg-migrate shim - on Windows that shim has no extension, which
// spawnSync can't execute directly (ENOENT), unlike POSIX where it's a
// shebang script.
const bin = path.join(__dirname, '..', 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
const migrationsDir = path.join(__dirname, '..', 'database', 'pg-migrations');
// Not present in the published tree — only exists in the full/private build.
// Migrations here (currently: AppSumo, DirectPay) apply on top of the public
// schema and are skipped entirely when this directory is absent.
const privateMigrationsDir = path.join(__dirname, '..', 'database', 'pg-migrations-private');

const userArgs = process.argv.slice(2);

function run(dir) {
  const defaultArgs = ['--migrations-dir', dir];

  // Allow unrun migrations from feature branches merged out of timestamp order
  // to run without failing checkOrder positional assertion.
  if (!userArgs.includes('--check-order') && !userArgs.includes('--no-check-order')) {
    defaultArgs.push('--no-check-order');
  }

  // Run each migration in its own transaction so newly added enum values can be
  // safely committed and used across consecutive pending migrations.
  if (!userArgs.includes('--single-transaction') && !userArgs.includes('--no-single-transaction')) {
    defaultArgs.push('--no-single-transaction');
  }

  const result = spawnSync(process.execPath, [bin, ...defaultArgs, ...userArgs], {
    stdio: ['inherit', 'inherit', 'pipe'],
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf-8',
  });

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    console.error(`[Migrations] Failed to run migration process:`, result.error.message || result.error);
    process.exit(1);
  }

  if (result.signal) {
    console.error(`[Migrations] Migration process was killed by signal: ${result.signal}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(migrationsDir);

if ((userArgs[0] === 'up' || userArgs[0] === 'down') && fs.existsSync(privateMigrationsDir)) {
  run(privateMigrationsDir);
}
