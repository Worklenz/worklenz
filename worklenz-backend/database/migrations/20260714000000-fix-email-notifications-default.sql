-- Fix trigger to explicitly set email_notifications_enabled = TRUE for new team members.
-- Existing rows are not modified to preserve explicit user opt-outs.

CREATE OR REPLACE FUNCTION notification_settings_insert_trigger_fn() RETURNS TRIGGER AS
$$
DECLARE
BEGIN
    IF (NOT EXISTS(SELECT 1 FROM notification_settings WHERE team_id = NEW.team_id AND user_id = NEW.user_id)) AND
       (is_null_or_empty(NEW.user_id) IS FALSE) AND (EXISTS(SELECT 1 FROM users WHERE id = NEW.user_id))
    THEN
        INSERT INTO notification_settings (email_notifications_enabled, popup_notifications_enabled, show_unread_items_count, user_id, team_id)
        VALUES (TRUE, TRUE, TRUE, NEW.user_id, NEW.team_id);
    END IF;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;
