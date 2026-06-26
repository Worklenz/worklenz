-- Fix remaining email notification edge cases:
-- 1. Keep base/migrated schemas aligned for task update retry attempts.
-- 2. Ensure project digests respect team email notification settings.
-- 3. Make SES delivery webhooks update multi-recipient email log rows.

ALTER TABLE task_updates
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS failed_task_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_update_id UUID UNIQUE,
    user_id UUID,
    task_id UUID,
    project_id UUID,
    type VARCHAR(50),
    email VARCHAR(255),
    attempts INTEGER,
    last_error TEXT,
    failed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_failed_task_notifications_user_id
ON failed_task_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_failed_task_notifications_failed_at
ON failed_task_notifications(failed_at);

CREATE OR REPLACE FUNCTION get_project_daily_digest() RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN

    SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT id,
                 name,
                 (SELECT name FROM teams WHERE id = projects.team_id) AS team_name,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.completed_at, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')) rec) AS today_completed,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.created_at, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')) rec) AS today_new,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.end_date, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'yyyy-mm-dd')) rec) AS due_tomorrow,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT u.name, u.email
                        FROM project_subscribers ps
                                 INNER JOIN users u ON ps.user_id = u.id
                                 INNER JOIN notification_settings ns ON ns.user_id = u.id
                        WHERE ps.project_id = projects.id
                          AND ns.team_id = projects.team_id
                          AND ns.email_notifications_enabled IS TRUE
                          AND u.is_deleted IS NOT TRUE) rec) AS subscribers

          FROM projects
          WHERE EXISTS(SELECT 1 FROM project_subscribers WHERE project_id = projects.id)
          ORDER BY team_id, name) rec;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION update_email_log_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE email_logs
    SET status = CASE
        WHEN NEW.event_type = 'send' THEN 'sent'::email_status_type
        WHEN NEW.event_type = 'delivery' THEN 'delivered'::email_status_type
        WHEN NEW.event_type = 'bounce' THEN 'bounced'::email_status_type
        WHEN NEW.event_type = 'complaint' THEN 'complaint'::email_status_type
        WHEN NEW.event_type = 'reject' THEN 'failed'::email_status_type
        ELSE status
    END,
    delivered_at = CASE
        WHEN NEW.event_type = 'delivery' THEN NEW.timestamp
        ELSE delivered_at
    END,
    updated_at = CURRENT_TIMESTAMP
    WHERE message_id = NEW.message_id
       OR message_id LIKE NEW.message_id || '-%';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
