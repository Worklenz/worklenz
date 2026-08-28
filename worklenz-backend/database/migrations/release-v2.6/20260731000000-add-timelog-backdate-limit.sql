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

ALTER TABLE organizations
  ADD CONSTRAINT organizations_timelog_backdate_limit_days_check
    CHECK (timelog_backdate_limit_days >= 0 AND timelog_backdate_limit_days <= 365);
