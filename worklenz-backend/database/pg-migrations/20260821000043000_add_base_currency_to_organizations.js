'use strict';
// Converted from database/migrations/release-v2.6/20260727000000-add-base-currency-to-organizations.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add base_currency to organizations
-- Description: Adds an organization-level base currency setting.
--              Finance Overview KPI cards convert all project amounts to this
--              currency using live exchange rates for unified totals.
--              Defaults to USD; organizations can change it at any time.
-- Date: 2026-07-27

-- ============================================================
-- UP (apply)
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) NOT NULL DEFAULT 'USD';

-- Backfill any existing rows that somehow have a NULL (safety net)
UPDATE organizations SET base_currency = 'USD' WHERE base_currency IS NULL OR base_currency = '';

COMMENT ON COLUMN organizations.base_currency IS
  'Organization preferred base currency (ISO 4217 code, e.g. USD, EUR, LKR).
   Finance Overview KPI totals are always converted to this currency.
   Defaults to USD. Organizations can change it in Settings > Financial & Billing > Organization Currency.';

-- ============================================================
-- DOWN (rollback) — run this block to undo the migration
-- ============================================================
-- ALTER TABLE organizations DROP COLUMN IF EXISTS base_currency;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
