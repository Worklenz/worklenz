-- Migration: Add reports_to_member_id to team_members
-- Description: Adds a column to team_members to establish a reporting hierarchy

ALTER TABLE team_members
ADD COLUMN reports_to_member_id UUID,
ADD CONSTRAINT fk_reports_to_member
    FOREIGN KEY (reports_to_member_id)
    REFERENCES team_members(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_to_member_id ON team_members(reports_to_member_id);
