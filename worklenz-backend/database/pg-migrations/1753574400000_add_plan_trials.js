'use strict';
// Converted from: database/migrations/release-v2.2.1-business-plan-trial/002_add_plan_trials.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add plan-specific trial support
-- Description: Enables 7-day trial for Business plan and other plan-specific trials
-- Date: 2025-01-18

-- 1. Add trial configuration columns to licensing_plan_tiers
ALTER TABLE licensing_plan_tiers
ADD COLUMN IF NOT EXISTS trial_duration_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS trial_enabled BOOLEAN DEFAULT FALSE;

-- 2. CREATE TABLE IF NOT EXISTS for tracking plan-specific trials
CREATE TABLE IF NOT EXISTS licensing_plan_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_tier_id UUID NOT NULL REFERENCES licensing_plan_tiers(id),
    trial_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    trial_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    converted_to_paid BOOLEAN DEFAULT FALSE,
    conversion_date TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, plan_tier_id) -- One trial per plan per user
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_licensing_plan_trials_user_id ON licensing_plan_trials(user_id);
CREATE INDEX IF NOT EXISTS idx_licensing_plan_trials_organization_id ON licensing_plan_trials(organization_id);
CREATE INDEX IF NOT EXISTS idx_licensing_plan_trials_active ON licensing_plan_trials(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_licensing_plan_trials_end_date ON licensing_plan_trials(trial_end_date) WHERE is_active = TRUE;

-- 4. Add comments for documentation
COMMENT ON TABLE licensing_plan_trials IS 'Tracks plan-specific trials for users, separate from initial signup trials';
COMMENT ON COLUMN licensing_plan_trials.id IS 'Unique identifier for the trial record';
COMMENT ON COLUMN licensing_plan_trials.user_id IS 'User who initiated the trial';
COMMENT ON COLUMN licensing_plan_trials.organization_id IS 'Organization associated with the trial';
COMMENT ON COLUMN licensing_plan_trials.plan_tier_id IS 'The plan tier being trialed';
COMMENT ON COLUMN licensing_plan_trials.trial_start_date IS 'When the trial began';
COMMENT ON COLUMN licensing_plan_trials.trial_end_date IS 'When the trial expires';
COMMENT ON COLUMN licensing_plan_trials.is_active IS 'Whether the trial is currently active';
COMMENT ON COLUMN licensing_plan_trials.converted_to_paid IS 'Whether the user converted to a paid subscription';
COMMENT ON COLUMN licensing_plan_trials.conversion_date IS 'Date of conversion to paid plan';
COMMENT ON COLUMN licensing_plan_trials.cancellation_reason IS 'Reason for not converting (optional feedback)';

COMMENT ON COLUMN licensing_plan_tiers.trial_duration_days IS 'Number of days for plan-specific trial (NULL means no trial available)';
COMMENT ON COLUMN licensing_plan_tiers.trial_enabled IS 'Whether trial is enabled for this plan tier';

-- 5. Update Business plan tier to enable 7-day trial
UPDATE licensing_plan_tiers
SET trial_duration_days = 7,
    trial_enabled = TRUE,
    updated_at = NOW()
WHERE tier_name = 'BUSINESS_LARGE';

-- 6. Create function to check if user can start a plan trial
CREATE OR REPLACE FUNCTION can_start_plan_trial(
    p_user_id UUID,
    p_plan_tier_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_trial_enabled BOOLEAN;
    v_existing_trial BOOLEAN;
BEGIN
    -- Check if trial is enabled for this plan
    SELECT trial_enabled INTO v_trial_enabled
    FROM licensing_plan_tiers
    WHERE id = p_plan_tier_id;

    IF v_trial_enabled IS NULL OR NOT v_trial_enabled THEN
        RETURN FALSE;
    END IF;

    -- Check if user already had a trial for this plan
    SELECT EXISTS(
        SELECT 1 FROM licensing_plan_trials
        WHERE user_id = p_user_id
        AND plan_tier_id = p_plan_tier_id
    ) INTO v_existing_trial;

    RETURN NOT v_existing_trial;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to start a plan trial
CREATE OR REPLACE FUNCTION start_plan_trial(
    p_user_id UUID,
    p_organization_id UUID,
    p_plan_tier_id UUID
) RETURNS UUID AS $$
DECLARE
    v_trial_id UUID;
    v_trial_days INTEGER;
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check if user can start trial
    IF NOT can_start_plan_trial(p_user_id, p_plan_tier_id) THEN
        RAISE EXCEPTION 'User cannot start trial for this plan';
    END IF;

    -- Get trial duration
    SELECT trial_duration_days INTO v_trial_days
    FROM licensing_plan_tiers
    WHERE id = p_plan_tier_id;

    -- Calculate end date
    v_end_date := NOW() + (v_trial_days || ' days')::INTERVAL;

    -- Deactivate any existing active trials for this user
    UPDATE licensing_plan_trials
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND is_active = TRUE;

    -- Insert new trial record
    INSERT INTO licensing_plan_trials (
        user_id,
        organization_id,
        plan_tier_id,
        trial_end_date
    ) VALUES (
        p_user_id,
        p_organization_id,
        p_plan_tier_id,
        v_end_date
    ) RETURNING id INTO v_trial_id;

    RETURN v_trial_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to get active plan trial for user
CREATE OR REPLACE FUNCTION get_active_plan_trial(p_user_id UUID)
RETURNS TABLE(
    trial_id UUID,
    plan_tier_id UUID,
    tier_name TEXT,
    display_name TEXT,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pt.id AS trial_id,
        pt.plan_tier_id,
        lpt.tier_name,
        lpt.display_name,
        pt.trial_end_date,
        GREATEST(0, EXTRACT(DAY FROM (pt.trial_end_date - NOW()))::INTEGER) AS days_remaining
    FROM licensing_plan_trials pt
    JOIN licensing_plan_tiers lpt ON lpt.id = pt.plan_tier_id
    WHERE pt.user_id = p_user_id
    AND pt.is_active = TRUE
    AND pt.trial_end_date > NOW()
    ORDER BY pt.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_licensing_plan_trials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER licensing_plan_trials_updated_at
BEFORE UPDATE ON licensing_plan_trials
FOR EACH ROW
EXECUTE FUNCTION update_licensing_plan_trials_updated_at();

-- 10. Grant permissions
GRANT SELECT, INSERT, UPDATE ON licensing_plan_trials TO worklenz_db_user;
GRANT EXECUTE ON FUNCTION can_start_plan_trial TO worklenz_db_user;
GRANT EXECUTE ON FUNCTION start_plan_trial TO worklenz_db_user;
GRANT EXECUTE ON FUNCTION get_active_plan_trial TO worklenz_db_user;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
