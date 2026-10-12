#!/usr/bin/env node
'use strict';

/**
 * One-time bootstrap for existing databases.
 *
 * node-pg-migrate's checkOrder does a positional comparison:
 *   migrations[i] (files sorted by name/timestamp)
 *   must equal
 *   runNames[i]   (DB rows sorted by run_on, id)
 *
 * So each row's run_on must equal the timestamp embedded in its filename,
 * ensuring DB order == file sort order.
 *
 * This script:
 *   1. Clears all existing pgmigrations rows.
 *   2. Re-inserts every .js file in pg-migrations/ with run_on derived
 *      from the Unix-ms timestamp prefix in the filename.
 *
 * Safe to re-run (truncates and re-seeds each time).
 *
 * Usage:  node scripts/migrate-bootstrap.js [--before <unix-ms-id>]
 *
 * When --before is supplied, only migrations with an ID lower than that
 * timestamp are seeded. This is useful when historical files are converted
 * to pg-migrations but a newer data migration must still run afterwards.
 */

const args = process.argv.slice(2);
const beforeMigration = args[0] === '--before' ? args[1] : undefined;

if (
  (args.length !== 0 && args.length !== 2) ||
  (args.length === 2 && (!beforeMigration || beforeMigration.startsWith('-')))
) {
  console.error('Usage: node scripts/migrate-bootstrap.js [--before <migration-name>]');
  process.exit(1);
}

require('dotenv').config();

const path = require('path');
const fs   = require('fs');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'pg-migrations');
const beforeIndex = process.argv.indexOf('--before');
const beforeMigrationId = beforeIndex === -1 ? null : Number(process.argv[beforeIndex + 1]);

if (beforeIndex !== -1 && (!Number.isSafeInteger(beforeMigrationId) || beforeMigrationId <= 0)) {
  console.error('The --before option requires a positive Unix-millisecond migration ID.');
  process.exit(1);
}

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

const pool = new Pool({
  host:     migrationDbHost,
  port:     Number(migrationDbPort),
  database: migrationDbName,
  user:     migrationDbUser,
  password: migrationDbPassword,
});

// Collect names sorted by filename (= timestamp order, same as node-pg-migrate)
const allNames = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.js'))
  .map(f => f.replace(/\.js$/, ''))
  .filter(name => beforeMigrationId === null || Number(name.split('_')[0]) < beforeMigrationId)
  .sort();

if (beforeMigration && !allNames.includes(beforeMigration)) {
  console.error(`Migration not found: ${beforeMigration}`);
  process.exit(1);
}

const names = beforeMigration
  ? allNames.filter(name => name < beforeMigration)
  : allNames;

// Extract the Unix-ms timestamp prefix from a migration name like
// "1740787200000_split_client_address_fields"
function runOnFromName(name) {
  const prefix = name.split('_')[0];
  if (/^\d{14}(?:\d{3})?$/.test(prefix)) {
    const year = parseInt(prefix.substring(0, 4), 10);
    const month = parseInt(prefix.substring(4, 6), 10) - 1;
    const day = parseInt(prefix.substring(6, 8), 10);
    const hour = parseInt(prefix.substring(8, 10), 10);
    const min = parseInt(prefix.substring(10, 12), 10);
    const sec = parseInt(prefix.substring(12, 14), 10);
    const milliseconds = prefix.length === 17 ? parseInt(prefix.substring(14, 17), 10) : 0;
    const d = new Date(Date.UTC(year, month, day, hour, min, sec, milliseconds));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month &&
      d.getUTCDate() === day &&
      d.getUTCHours() === hour &&
      d.getUTCMinutes() === min &&
      d.getUTCSeconds() === sec &&
      d.getUTCMilliseconds() === milliseconds
    ) {
      return d;
    }
    throw new Error(`Invalid 14-digit date prefix: ${prefix} in ${name}`);
  }
  if (!/^\d+$/.test(prefix)) {
    throw new Error(`Cannot parse numeric timestamp from: ${name}`);
  }
  const ts = parseInt(prefix, 10);
  if (!Number.isFinite(ts)) throw new Error(`Cannot parse timestamp from: ${name}`);
  return new Date(ts);
}

async function run() {
  // Pre-validate all migration names before touching pgmigrations.
  const validated = [];
  let lastRunOn = new Date(0);
  for (const name of names) {
    let run_on = runOnFromName(name);
    // Keep database ordering identical to filename ordering.
    if (run_on <= lastRunOn) {
      run_on = new Date(lastRunOn.getTime() + 1000);
    }
    lastRunOn = run_on;
    validated.push({ name, run_on });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // `CREATE TABLE IF NOT EXISTS` still requires CREATE on schema public even
    // when pgmigrations already exists. Avoid that unnecessary permission
    // requirement when bootstrapping an established database.
    const { rows: migrationTableRows } = await client.query(
      "SELECT to_regclass('public.pgmigrations') IS NOT NULL AS exists"
    );
    if (!migrationTableRows[0]?.exists) {
      await client.query(`
        CREATE TABLE pgmigrations (
          id      SERIAL PRIMARY KEY,
          name    VARCHAR(255) NOT NULL,
          run_on  TIMESTAMP NOT NULL
        )
      `);
    }

    // Wipe all existing rows so we start from a clean, ordered state
    const { rowCount: deleted } = await client.query('DELETE FROM pgmigrations');
    console.log(`  cleared   ${deleted} existing row(s)`);

    // Re-insert every migration with monotonic run_on matching file sort order
    for (const { name, run_on } of validated) {
      await client.query(
        'INSERT INTO pgmigrations (name, run_on) VALUES ($1, $2)',
        [name, run_on]
      );
      console.log(`  inserted  ${name}  (run_on=${run_on.toISOString()})`);
    }

    await client.query('COMMIT');
    console.log(`\nBootstrap complete — ${names.length} migrations recorded.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Bootstrap failed:', err.message);
  process.exit(1);
});
