#!/usr/bin/env node
'use strict';

// Loads .env and runs node-pg-migrate for all enabled addons.
// Usage: node scripts/migrate-addons.js <up|down> [args...]

require('dotenv').config();

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT = '5432', DB_NAME } = process.env;

if (!DB_USER || !DB_NAME) {
  console.error('Missing required DB env vars (DB_USER, DB_NAME, DB_HOST, DB_PASSWORD).');
  process.exit(1);
}

const databaseUrl = `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD || '')}@${DB_HOST || 'localhost'}:${DB_PORT}/${DB_NAME}`;

const bin = path.join(__dirname, '..', 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
const args = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['up'];

function resolveAddonDir(addonId) {
  const candidates = [
    path.resolve(process.cwd(), 'addons', addonId),
    path.resolve(process.cwd(), '../addons', addonId),
    path.resolve(__dirname, '../../addons', addonId),
    path.resolve(__dirname, '../../../addons', addonId),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
}

const rawAddons = process.env.ENABLED_ADDONS || '';
const enabledAddonIds = rawAddons
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

if (enabledAddonIds.length === 0) {
  console.log('[Addon Migrations] No enabled addons specified in ENABLED_ADDONS.');
  process.exit(0);
}

console.log(`[Addon Migrations] Running migrations for enabled addons: ${enabledAddonIds.join(', ')}`);

for (const addonId of enabledAddonIds) {
  const addonDir = resolveAddonDir(addonId);
  if (!addonDir) {
    console.warn(`[Addon Migrations] Directory for enabled addon "${addonId}" not found. Skipping.`);
    continue;
  }

  const manifestPath = path.join(addonDir, 'manifest.json');
  let migrationsTable = `pgmigrations_${addonId.replace(/-/g, '_')}`;

  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (manifest.migrationsTable) {
        migrationsTable = manifest.migrationsTable;
      }
    } catch (e) {
      console.error(`[Addon Migrations] Failed to parse manifest at ${manifestPath}`, e);
    }
  }

  const migrationsDir = path.join(addonDir, 'backend', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log(`[Addon Migrations] No backend migrations directory found for "${addonId}". Skipping.`);
    continue;
  }

  console.log(`\n========================================`);
  console.log(`Applying migrations for addon: ${addonId}`);
  console.log(`Directory: ${migrationsDir}`);
  console.log(`Tracking table: ${migrationsTable}`);
  console.log(`========================================\n`);

  try {
    execFileSync(
      process.execPath,
      [bin, '--migrations-dir', migrationsDir, '--migrations-table', migrationsTable, ...args],
      {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: databaseUrl },
      }
    );
  } catch (error) {
    console.error(`[Addon Migrations] Failed to run migrations for addon "${addonId}":`, error.message);
    process.exit(1);
  }
}

console.log('\n[Addon Migrations] All addon migrations processed successfully.');
