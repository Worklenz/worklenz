'use strict';
// Converted from: database/migrations/20260220000003-add-team-currency-to-rate-cards.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add team_id and currency columns to finance_rate_cards
-- Description: Adds organization scoping and currency support to rate cards
-- Date: 2026-02-20
-- Version: Fix Rate Card Creation

-- Add team_id column to track which team/organization owns the rate card
ALTER TABLE finance_rate_cards ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Add currency column to store the currency for the rate card
ALTER TABLE finance_rate_cards ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'usd';

-- CREATE INDEX IF NOT EXISTS for team_id for faster queries
CREATE INDEX IF NOT EXISTS idx_finance_rate_cards_team_id ON finance_rate_cards(team_id);

-- Add comments to explain the columns
COMMENT ON COLUMN finance_rate_cards.team_id IS 'References the team/organization that owns this rate card';
COMMENT ON COLUMN finance_rate_cards.currency IS 'Currency code for the rate card (e.g., usd, eur, gbp)';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
