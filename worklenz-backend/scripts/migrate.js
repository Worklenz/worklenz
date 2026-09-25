#!/usr/bin/env node
'use strict';

// Loads .env and runs node-pg-migrate with DATABASE_URL built from DB_* vars.
// Usage: node scripts/migrate.js <up|down|create> [args...]

require('dotenv').config();

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT = '5432', DB_NAME } = process.env;

if (!DB_USER || !DB_NAME) {
  console.error('Missing required DB env vars (DB_USER, DB_NAME, DB_HOST, DB_PASSWORD).');
  process.exit(1);
}

const databaseUrl = `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD || '')}@${DB_HOST || 'localhost'}:${DB_PORT}/${DB_NAME}`;

// Invoke the underlying JS entrypoint directly with `node` rather than the
// .bin/node-pg-migrate shim - on Windows that shim has no extension, which
// spawnSync can't execute directly (ENOENT), unlike POSIX where it's a
// shebang script.
const bin = path.join(__dirname, '..', 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
const migrationsDir = path.join(__dirname, '..', 'database', 'pg-migrations');
// Not present in the published tree — only exists in private builds.
// Migrations here apply on top of the public schema and are skipped entirely when absent.
const privateMigrationsDir = path.join(__dirname, '..', 'database', 'pg-migrations-private');

const args = process.argv.slice(2);

function run(dir) {
  const result = spawnSync(
    process.execPath,
    [bin, '--migrations-dir', dir, ...args],
    {
      stdio: ['inherit', 'inherit', 'pipe'],
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf-8',
    }
  );

  if (result.stderr) {
    // Filter out non-fatal warnings about 14-digit timestamp prefixes from node-pg-migrate
    const filteredStderr = result.stderr
      .split('\n')
      .filter((line) => !line.includes("Can't determine timestamp for"))
      .join('\n')
      .trim();
    if (filteredStderr) {
      process.stderr.write(filteredStderr + '\n');
    }
  }

  if (result.status !== null && result.status !== 0) {
    process.exit(result.status);
  }
}

run(migrationsDir);

if ((args[0] === 'up' || args[0] === 'down') && fs.existsSync(privateMigrationsDir)) {
  run(privateMigrationsDir);
}
