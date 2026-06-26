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
  const ts = parseInt(name.split('_')[0], 10);
  if (!Number.isFinite(ts)) throw new Error(`Cannot parse timestamp from: ${name}`);
  return new Date(ts);
}

async function run() {
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

    // Re-insert every migration with run_on = its own timestamp
    for (const name of names) {
      const run_on = runOnFromName(name);
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
