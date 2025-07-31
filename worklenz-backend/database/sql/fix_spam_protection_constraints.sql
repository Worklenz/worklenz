-- Fix for notification_settings constraint issue during signup
-- This makes the team_id nullable temporarily during user creation

-- First, drop the existing NOT NULL constraint
ALTER TABLE notification_settings 
ALTER COLUMN team_id DROP NOT NULL;

-- Add a constraint that ensures team_id is not null when there's no ongoing signup
ALTER TABLE notification_settings 
ADD CONSTRAINT notification_settings_team_id_check 
CHECK (team_id IS NOT NULL OR user_id IS NOT NULL);

-- Update the notification_settings trigger to handle null team_id gracefully
CREATE OR REPLACE FUNCTION notification_settings_insert_trigger_fn() RETURNS TRIGGER AS
$$
BEGIN
    -- Only insert if team_id is not null
    IF NEW.team_id IS NOT NULL AND 
       (NOT EXISTS(SELECT 1 FROM notification_settings WHERE team_id = NEW.team_id AND user_id = NEW.user_id)) AND
       (NEW.active = TRUE)
    THEN
        INSERT INTO notification_settings (popup_notifications_enabled, show_unread_items_count, user_id,
                                           email_notifications_enabled, team_id, daily_digest_enabled)
        VALUES (TRUE, TRUE, NEW.user_id, TRUE, NEW.team_id, FALSE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also update the teams table to ensure the status column doesn't interfere with signup
ALTER TABLE teams 
DROP CONSTRAINT IF EXISTS teams_status_check;

ALTER TABLE teams 
ADD CONSTRAINT teams_status_check 
CHECK (status IS NULL OR status IN ('active', 'flagged', 'suspended'));

-- Set default value for status
ALTER TABLE teams 
ALTER COLUMN status SET DEFAULT 'active';

-- Update existing null values
UPDATE teams SET status = 'active' WHERE status IS NULL;