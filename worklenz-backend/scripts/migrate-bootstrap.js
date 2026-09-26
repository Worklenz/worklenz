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
 * Usage:  node scripts/migrate-bootstrap.js
 */

require('dotenv').config();

const path = require('path');
const fs   = require('fs');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'pg-migrations');

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT = '5432', DB_NAME } = process.env;

if (!DB_USER || !DB_NAME) {
  console.error('Missing required DB env vars (DB_USER, DB_NAME, DB_HOST, DB_PASSWORD).');
  process.exit(1);
}

const pool = new Pool({
  host:     DB_HOST || 'localhost',
  port:     Number(DB_PORT),
  database: DB_NAME,
  user:     DB_USER,
  password: DB_PASSWORD,
});

// Collect names sorted by filename (= timestamp order, same as node-pg-migrate)
const names = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.js'))
  .map(f => f.replace(/\.js$/, ''))
  .sort();

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
  // Pre-validate all migration names before touching pgmigrations
  const validated = [];
  let lastRunOn = new Date(0);
  for (const name of names) {
    let run_on = runOnFromName(name);
    // Ensure monotonic timestamps so ORDER BY run_on, id in DB matches file sort order
    if (run_on <= lastRunOn) {
      run_on = new Date(lastRunOn.getTime() + 1000);
    }
    lastRunOn = run_on;
    validated.push({ name, run_on });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS pgmigrations (
        id      SERIAL PRIMARY KEY,
        name    VARCHAR(255) NOT NULL,
        run_on  TIMESTAMP NOT NULL
      )
    `);

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
