#!/usr/bin/env node
'use strict';

// Do not replay historical migrations against an existing database whose
// migration history is unknown. The database initializer creates the marker
// only for a newly initialized base schema, never for a restored backup.
const { Pool } = require('pg');
const { spawnSync } = require('child_process');
const path = require('path');

async function runComposeMigrations(pool, runMigrations) {
  try {
    const relations = await pool.query(`
      SELECT to_regclass('public.worklenz_compose_fresh_install') IS NOT NULL AS fresh,
             to_regclass('public.pgmigrations') IS NOT NULL AS has_history
    `);
    const { fresh, has_history: hasHistory } = relations.rows[0];
    let hasRecordedMigration = false;
    if (hasHistory) {
      const result = await pool.query('SELECT EXISTS (SELECT 1 FROM public.pgmigrations) AS recorded');
      hasRecordedMigration = result.rows[0].recorded;
    }
    if (!fresh && !hasRecordedMigration) {
      throw new Error('Existing database has no recorded Node migration history. Back up the database and review the migration documentation before proceeding; no migrations were run.');
    }

    const result = runMigrations();
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Migration process failed (${result.signal || result.status}).`);
    if (fresh) await pool.query('DROP TABLE IF EXISTS public.worklenz_compose_fresh_install');
    console.log('Compose database migrations completed.');
  } finally {
    await pool.end();
  }
}

async function main() {
  const env = process.env;
  const pool = new Pool({
    user: env.MIGRATION_DB_USER || env.DB_USER,
    password: env.MIGRATION_DB_PASSWORD ?? env.DB_PASSWORD,
    host: env.MIGRATION_DB_HOST || env.DB_HOST || 'localhost',
    port: Number(env.MIGRATION_DB_PORT || env.DB_PORT || 5432),
    database: env.MIGRATION_DB_NAME || env.DB_NAME,
  });
  await runComposeMigrations(pool, () => spawnSync(
    process.execPath,
    [path.join(__dirname, 'migrate.js'), 'up'],
    { stdio: 'inherit', env }
  ));
}

if (require.main === module) {
  main().catch(error => {
    console.error('Compose database migration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { runComposeMigrations };
