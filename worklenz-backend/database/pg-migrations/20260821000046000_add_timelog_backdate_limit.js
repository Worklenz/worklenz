'use strict';
// Converted from database/migrations/release-v2.6/20260731000000-add-timelog-backdate-limit.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add timelog backdate limit
-- Description: Organization-level cap on how far back a user may date a manual time log.
--              0 (the default) means unlimited, preserving existing behaviour for all orgs.
-- Date: 2026-07-31

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS timelog_backdate_limit_days INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN organizations.timelog_backdate_limit_days IS
  'Maximum number of days a manual time log may be backdated. 0 means no limit. Enforced on time log create and on edits that change the log date.';

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_timelog_backdate_limit_days_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_timelog_backdate_limit_days_check') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_timelog_backdate_limit_days_check CHECK (timelog_backdate_limit_days >= 0 AND timelog_backdate_limit_days <= 365);
  END IF;
END $$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
