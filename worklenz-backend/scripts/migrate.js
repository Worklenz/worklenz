#!/usr/bin/env node
'use strict';

// Loads .env and runs node-pg-migrate with DATABASE_URL built from DB_* vars.
// Usage: node scripts/migrate.js <up|down|create> [args...]

require('dotenv').config();

const { execFileSync } = require('child_process');
const path = require('path');

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT = '5432', DB_NAME } = process.env;

if (!DB_USER || !DB_NAME) {
  console.error('Missing required DB env vars (DB_USER, DB_NAME, DB_HOST, DB_PASSWORD).');
  process.exit(1);
}

const databaseUrl = `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD || '')}@${DB_HOST || 'localhost'}:${DB_PORT}/${DB_NAME}`;

const bin = path.join(__dirname, '..', 'node_modules', '.bin', 'node-pg-migrate');
const migrationsDir = path.join(__dirname, '..', 'database', 'pg-migrations');

execFileSync(bin, ['--migrations-dir', migrationsDir, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
