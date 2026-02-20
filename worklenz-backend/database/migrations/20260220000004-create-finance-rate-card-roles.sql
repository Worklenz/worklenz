-- Migration: Create finance_rate_card_roles table
-- Description: Stores job roles and their rates for organization-level rate cards
-- Date: 2026-02-20
-- Version: Fix Rate Card Job Roles

-- Create the finance_rate_card_roles table
CREATE TABLE IF NOT EXISTS finance_rate_card_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_card_id UUID NOT NULL REFERENCES finance_rate_cards(id) ON DELETE CASCADE,
    job_title_id UUID NOT NULL REFERENCES job_titles(id) ON DELETE CASCADE,
    rate NUMERIC(10,2) DEFAULT 0,
    man_day_rate NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rate_card_id, job_title_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_finance_rate_card_roles_rate_card_id 
ON finance_rate_card_roles(rate_card_id);

CREATE INDEX IF NOT EXISTS idx_finance_rate_card_roles_job_title_id 
ON finance_rate_card_roles(job_title_id);

-- Add comments
COMMENT ON TABLE finance_rate_card_roles IS 'Stores job roles and their rates for organization-level rate cards';
COMMENT ON COLUMN finance_rate_card_roles.rate IS 'Hourly rate for this job role';
COMMENT ON COLUMN finance_rate_card_roles.man_day_rate IS 'Man-day rate for this job role';
