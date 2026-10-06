#!/usr/bin/env node
'use strict';

// One-time repair for IDs converted from YYYYMMDDHHmmss to Unix milliseconds.
// Dry run by default; pass --apply only after a verified backup.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const legacyPrefixes = new Set(['20260804000000','20260820000000','20260821100000','20260831100000','20260902100000','20260902110000','20260903000000','20260903120000','20260907115931','20260907120000','20260907130000','20260907140000','20260907150000','20260907160000','20260907170000','20260910000000','20260910100000','20260914000000','20260914100000','20260916120000','20260917000000','20260918000000','20260918120000','20260918140000','20260921000000','20260921120000','20260921150000','20260922000000','20260923140000','20260925112400','20260925120000','20260928120000','20260928140000','20260929100000','20260929110000','20260929120000','20260929130000','20260929140000']);
const directory = path.join(__dirname, '..', 'database', 'pg-migrations');
const explicitRenames = [{ oldName: '1781000000000_add_practices', newName: '1790694000001_add_practices' }];
const isApply = process.argv.includes('--apply');
const toLegacyPrefix = (timestamp) => {
  const date = new Date(Number(timestamp));
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
};
const mappings = [...fs.readdirSync(directory).filter(file => /^\d{13}_.*\.js$/.test(file)).flatMap((file) => {
  const [timestamp, suffix] = file.slice(0, -3).split(/_(.*)/s);
  const oldPrefix = toLegacyPrefix(timestamp);
  return legacyPrefixes.has(oldPrefix) ? [{ oldName: `${oldPrefix}_${suffix}`, newName: `${timestamp}_${suffix}` }] : [];
}), ...explicitRenames];
async function run() {
  const pool = new Pool({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT id, name, run_on FROM pgmigrations WHERE name = ANY($1) ORDER BY run_on, id', [mappings.map(({ oldName }) => oldName)]);
    console.table(rows);
    console.log(`${rows.length} legacy history row(s) found. ${isApply ? 'Applying changes.' : 'Dry run; no changes made.'}`);
    if (!isApply) return;
    await client.query('BEGIN');
    for (const { oldName, newName } of mappings) await client.query('UPDATE pgmigrations SET name = $1 WHERE name = $2', [newName, oldName]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
}
run().catch((error) => { console.error('Legacy migration-ID reconciliation failed:', error.message); process.exit(1); });
