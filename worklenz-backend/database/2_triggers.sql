-- Lowercase email
CREATE OR REPLACE FUNCTION lower_email() RETURNS TRIGGER AS
$$
DECLARE
BEGIN

    IF (is_null_or_empty(NEW.email) IS FALSE)
    THEN
        NEW.email = LOWER(TRIM(NEW.email));
    END IF;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_email_lower ON users;
CREATE TRIGGER users_email_lower
    BEFORE INSERT OR UPDATE
    ON users
EXECUTE FUNCTION lower_email();

DROP TRIGGER IF EXISTS email_invitations_email_lower ON email_invitations;
CREATE TRIGGER email_invitations_email_lower
    BEFORE INSERT OR UPDATE
    ON email_invitations
EXECUTE FUNCTION lower_email();
-- Lowercase email

-- Set task completed date
CREATE OR REPLACE FUNCTION task_status_change_trigger_fn() RETURNS TRIGGER AS
$$
DECLARE
BEGIN
    IF EXISTS(SELECT 1
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = NEW.status_id)
                AND is_done IS TRUE)
    THEN
        UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    ELSE
        UPDATE tasks SET completed_at = NULL WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tasks_status_id_change
    AFTER UPDATE OF status_id
    ON tasks
    FOR EACH ROW
    WHEN (OLD.status_id IS DISTINCT FROM new.status_id)
EXECUTE FUNCTION task_status_change_trigger_fn();
-- Set task completed date

-- Insert notification settings for new team members
CREATE OR REPLACE FUNCTION notification_settings_insert_trigger_fn() RETURNS TRIGGER AS
$$
DECLARE
BEGIN

    IF (NOT EXISTS(SELECT 1 FROM notification_settings WHERE team_id = NEW.team_id AND user_id = NEW.user_id)) AND
       (is_null_or_empty(NEW.user_id) IS FALSE) AND (EXISTS(SELECT 1 FROM users WHERE id = NEW.user_id))
    THEN
        INSERT INTO notification_settings (popup_notifications_enabled, show_unread_items_count, user_id,
                                           team_id)
        VALUES (TRUE, TRUE, NEW.user_id, NEW.team_id);
    END IF;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS insert_notification_settings ON team_members;
CREATE TRIGGER insert_notification_settings
    AFTER INSERT
    ON team_members
    FOR EACH ROW
EXECUTE FUNCTION notification_settings_insert_trigger_fn();
-- Insert notification settings for new team members

-- Delete notification settings when removing team members
CREATE OR REPLACE FUNCTION notification_settings_delete_trigger_fn() RETURNS TRIGGER AS
$$
DECLARE
BEGIN
    DELETE FROM notification_settings WHERE user_id = OLD.user_id AND team_id = OLD.team_id;
    RETURN OLD;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS remove_notification_settings ON team_members;
CREATE TRIGGER remove_notification_settings
    BEFORE DELETE
    ON team_members
    FOR EACH ROW
EXECUTE FUNCTION notification_settings_delete_trigger_fn();
-- Delete notification settings when removing team members

-- Set task updated at
CREATE OR REPLACE FUNCTION set_task_updated_at_trigger_fn() RETURNS TRIGGER AS
$$
DECLARE
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_task_updated_at
    BEFORE UPDATE
    ON tasks
    FOR EACH ROW
EXECUTE FUNCTION set_task_updated_at_trigger_fn();
-- Set task updated at

-- Update project tasks counter
CREATE OR REPLACE FUNCTION update_project_tasks_counter_trigger_fn() RETURNS TRIGGER AS
$$
DECLARE
BEGIN

    UPDATE projects SET tasks_counter = (tasks_counter + 1) WHERE id = NEW.project_id;
    NEW.task_no = (SELECT tasks_counter FROM projects WHERE id = NEW.project_id);

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_tasks_counter_trigger ON tasks;
CREATE TRIGGER projects_tasks_counter_trigger
    BEFORE INSERT
    ON tasks
    FOR EACH ROW
EXECUTE FUNCTION update_project_tasks_counter_trigger_fn();
-- Update project tasks counter

-- Task status change trigger
CREATE OR REPLACE FUNCTION tasks_task_subscriber_notify_done_trigger() RETURNS TRIGGER AS
$$
DECLARE
BEGIN
    IF (EXISTS(SELECT 1
               FROM sys_task_status_categories
               WHERE id = (SELECT category_id FROM task_statuses WHERE id = NEW.status_id)
                 AND is_done IS TRUE))
    THEN
        PERFORM pg_notify('db_task_status_changed', NEW.id::TEXT);
    END IF;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tasks_task_subscriber_notify_done
    BEFORE UPDATE OF status_id
    ON tasks
    FOR EACH ROW
    WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
EXECUTE FUNCTION tasks_task_subscriber_notify_done_trigger();
-- Task status change trigger
