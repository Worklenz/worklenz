-- Add retry mechanism to prevent infinite email loops
-- This adds an attempts counter and max retry limit

-- 1. Add attempts column to track retry count
ALTER TABLE task_updates
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

-- 2. Create a table for permanently failed notifications (for debugging/review)
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

-- 3. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_failed_task_notifications_user_id
ON failed_task_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_failed_task_notifications_failed_at
ON failed_task_notifications(failed_at);

-- 4. Update the get_task_updates function to only return notifications with attempts < 3
CREATE OR REPLACE FUNCTION get_task_updates() RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
    _max_attempts INTEGER := 3;  -- Maximum retry attempts
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (SELECT name,
                 email,
                 (SELECT id
                  FROM team_members
                  WHERE team_id = users.active_team
                    AND user_id = users.id) AS team_member_id,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS teams
                  FROM (SELECT id,
                               name,
                               (SELECT team_member_id
                                FROM team_member_info_view
                                WHERE team_id = teams.id
                                  AND user_id = users.id) AS team_member_id,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                                FROM (SELECT id,
                                             name,
                                             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                              FROM (SELECT t.id,
                                                           t.name AS name,
                                                           task_updates.id AS update_id,
                                                           task_updates.attempts AS attempts,
                                                           (SELECT name FROM users WHERE id = task_updates.reporter_id) AS updater_name,
                                                           (SELECT STRING_AGG(DISTINCT
                                                                              (SELECT name
                                                                               FROM team_member_info_view
                                                                               WHERE team_member_id = tasks_assignees.team_member_id),
                                                                              ', ')
                                                            FROM tasks_assignees
                                                            WHERE task_id = task_updates.task_id) AS members
                                                    FROM task_updates
                                                             INNER JOIN tasks t ON task_updates.task_id = t.id
                                                    WHERE task_updates.user_id = users.id
                                                      AND task_updates.project_id = projects.id
                                                      AND task_updates.type = 'ASSIGN'
                                                      AND is_sent IS FALSE
                                                      AND task_updates.attempts < _max_attempts
                                                    ORDER BY task_updates.created_at) r)
                                      FROM projects
                                      WHERE team_id = teams.id
                                        AND EXISTS(SELECT 1
                                                   FROM task_updates
                                                   WHERE project_id = projects.id
                                                     AND type = 'ASSIGN'
                                                     AND is_sent IS FALSE
                                                     AND attempts < _max_attempts)) r)
                        FROM teams
                        WHERE EXISTS(SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = users.id)
                          AND (SELECT email_notifications_enabled
                               FROM notification_settings
                               WHERE team_id = teams.id
                                 AND user_id = users.id) IS TRUE) r)
          FROM users
          WHERE EXISTS(SELECT 1 FROM task_updates WHERE user_id = users.id)
            AND users.is_deleted IS NOT TRUE) rec;

    -- Individual task_updates will be deleted after successful email send
    -- No batch update needed here

    RETURN _result;
END
$$;

-- 5. Clean up notifications that exceeded max attempts (move to failed table)
INSERT INTO failed_task_notifications (
    task_update_id,
    user_id,
    task_id,
    project_id,
    type,
    email,
    attempts,
    last_error,
    created_at
)
SELECT
    tu.id,
    tu.user_id,
    tu.task_id,
    tu.project_id,
    tu.type,
    u.email,
    tu.attempts,
    'Max retry attempts exceeded',
    tu.created_at
FROM task_updates tu
JOIN users u ON tu.user_id = u.id
WHERE tu.attempts >= 3
  AND NOT EXISTS (
    SELECT 1 FROM failed_task_notifications
    WHERE task_update_id = tu.id
  );

-- 6. Delete task_updates that exceeded max attempts
DELETE FROM task_updates
WHERE attempts >= 3;

COMMENT ON TABLE failed_task_notifications IS 'Stores notifications that failed to send after max retry attempts';
COMMENT ON COLUMN task_updates.attempts IS 'Number of times we attempted to send this notification (max 3)';
