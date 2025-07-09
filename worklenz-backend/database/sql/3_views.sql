CREATE OR REPLACE VIEW task_labels_view(name, task_id, label_id) AS
SELECT (SELECT team_labels.name
        FROM team_labels
        WHERE team_labels.id = task_labels.label_id) AS name,
       task_labels.task_id,
       task_labels.label_id
FROM task_labels;

CREATE OR REPLACE VIEW tasks_with_status_view(task_id, parent_task_id, is_todo, is_doing, is_done) AS
SELECT tasks.id AS task_id,
       tasks.parent_task_id,
       stsc.is_todo,
       stsc.is_doing,
       stsc.is_done
FROM tasks
         JOIN task_statuses ts ON tasks.status_id = ts.id
         JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
WHERE tasks.archived IS FALSE;

CREATE OR REPLACE VIEW team_member_info_view(avatar_url, email, name, user_id, team_member_id, team_id, active) AS
SELECT u.avatar_url,
       COALESCE(u.email, (SELECT email_invitations.email
                          FROM email_invitations
                          WHERE email_invitations.team_member_id = team_members.id)) AS email,
       COALESCE(u.name, (SELECT email_invitations.name
                         FROM email_invitations
                         WHERE email_invitations.team_member_id = team_members.id)) AS name,
       u.id AS user_id,
       team_members.id AS team_member_id,
       team_members.team_id,
       team_members.active
FROM team_members
         LEFT JOIN users u ON team_members.user_id = u.id;

-- PERFORMANCE OPTIMIZATION: Create materialized view for team member info
-- This pre-calculates the expensive joins and subqueries from team_member_info_view
CREATE MATERIALIZED VIEW IF NOT EXISTS team_member_info_mv AS
SELECT 
    u.avatar_url,
    COALESCE(u.email, ei.email) AS email,
    COALESCE(u.name, ei.name) AS name,
    u.id AS user_id,
    tm.id AS team_member_id,
    tm.team_id,
    tm.active,
    u.socket_id
FROM team_members tm
LEFT JOIN users u ON tm.user_id = u.id
LEFT JOIN email_invitations ei ON ei.team_member_id = tm.id
WHERE tm.active = TRUE;

-- Create unique index on the materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_member_info_mv_team_member_id 
ON team_member_info_mv(team_member_id);

CREATE INDEX IF NOT EXISTS idx_team_member_info_mv_team_user 
ON team_member_info_mv(team_id, user_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_team_member_info_mv()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY team_member_info_mv;
END;
$$;

