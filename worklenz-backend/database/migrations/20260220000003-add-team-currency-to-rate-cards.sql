-- Migration: Add team_id and currency columns to finance_rate_cards
-- Description: Adds organization scoping and currency support to rate cards
-- Date: 2026-02-20
-- Version: Fix Rate Card Creation

-- Add team_id column to track which team/organization owns the rate card
ALTER TABLE finance_rate_cards ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Add currency column to store the currency for the rate card
ALTER TABLE finance_rate_cards ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'usd';

-- Create index for team_id for faster queries
CREATE INDEX IF NOT EXISTS idx_finance_rate_cards_team_id ON finance_rate_cards(team_id);

-- Add comments to explain the columns
COMMENT ON COLUMN finance_rate_cards.team_id IS 'References the team/organization that owns this rate card';
COMMENT ON COLUMN finance_rate_cards.currency IS 'Currency code for the rate card (e.g., usd, eur, gbp)';
