CREATE VIEW task_labels_view(name, task_id, label_id) AS
SELECT (SELECT team_labels.name
        FROM team_labels
        WHERE team_labels.id = task_labels.label_id) AS name,
       task_labels.task_id,
       task_labels.label_id
FROM task_labels;

CREATE VIEW tasks_with_status_view(task_id, parent_task_id, is_todo, is_doing, is_done) AS
SELECT tasks.id AS task_id,
       tasks.parent_task_id,
       stsc.is_todo,
       stsc.is_doing,
       stsc.is_done
FROM tasks
         JOIN task_statuses ts ON tasks.status_id = ts.id
         JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
WHERE tasks.archived IS FALSE;

CREATE VIEW team_member_info_view(avatar_url, email, name, user_id, team_member_id, team_id) AS
SELECT u.avatar_url,
       COALESCE(u.email, (SELECT email_invitations.email
                          FROM email_invitations
                          WHERE email_invitations.team_member_id = team_members.id)) AS email,
       COALESCE(u.name, (SELECT email_invitations.name
                         FROM email_invitations
                         WHERE email_invitations.team_member_id = team_members.id)) AS name,
       u.id AS user_id,
       team_members.id AS team_member_id,
       team_members.team_id
FROM team_members
         LEFT JOIN users u ON team_members.user_id = u.id;


