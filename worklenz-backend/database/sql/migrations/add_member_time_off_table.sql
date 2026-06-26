-- Migration: Add member_time_off table for tracking team member time-off periods
-- This table supports the task-level timeline view feature

CREATE TABLE IF NOT EXISTS member_time_off (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_time_off_date_range CHECK (end_date >= start_date)
);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_member_time_off_dates 
    ON member_time_off(team_member_id, start_date, end_date);

-- Index for organization-level queries
CREATE INDEX IF NOT EXISTS idx_member_time_off_org 
    ON member_time_off(organization_id);

-- Comment for documentation
COMMENT ON TABLE member_time_off IS 'Stores time-off periods for team members to track availability in schedule timeline';
COMMENT ON COLUMN member_time_off.reason IS 'Optional reason for time-off (vacation, sick leave, etc.)';
