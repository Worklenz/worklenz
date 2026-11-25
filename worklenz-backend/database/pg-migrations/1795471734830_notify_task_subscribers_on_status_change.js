/**
 * Include task subscribers ("Notify" feature in the task drawer) in the member
 * list of handle_on_task_status_change, so subscribers receive in-app
 * notifications on status changes just like task assignees. Previously only
 * rows from tasks_assignees were returned by get_task_assignees, so a user added
 * through Notify was never notified on task changes.
 *
 * The dedup key is user_id: an assignee who also subscribed gets one
 * notification, not two.
 */

exports.up = pgm => {
  // Members JSON shape must match get_task_assignees exactly — the
  // NotificationsService fanout reads user_id / team_id / socket_id / email.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_task_notify_recipients(_task_id uuid, _include_subscribers boolean DEFAULT true) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _output JSON;
    BEGIN
        SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
        FROM (SELECT DISTINCT ON (user_id)
                     team_member_id,
                     project_member_id,
                     name,
                     email_notifications_enabled,
                     avatar_url,
                     user_id,
                     email,
                     socket_id,
                     team_id
              FROM (
                  -- Task assignees (same rows as get_task_assignees)
                  SELECT tasks_assignees.team_member_id,
                         tasks_assignees.project_member_id,
                         COALESCE((SELECT name
                                   FROM team_member_info_view
                                   WHERE team_member_info_view.team_member_id = tm.id), '') AS name,
                         COALESCE((SELECT email_notifications_enabled
                                   FROM notification_settings
                                   WHERE team_id = tm.team_id
                                     AND notification_settings.user_id = u.id), false) AS email_notifications_enabled,
                         COALESCE(u.avatar_url, '') AS avatar_url,
                         u.id AS user_id,
                         COALESCE(u.email, '') AS email,
                         COALESCE(u.socket_id, '') AS socket_id,
                         tm.team_id AS team_id
                  FROM tasks_assignees
                           INNER JOIN team_members tm ON tm.id = tasks_assignees.team_member_id
                           LEFT JOIN users u ON tm.user_id = u.id
                  WHERE tasks_assignees.task_id = _task_id
                    AND (_include_subscribers
                         OR NOT EXISTS(SELECT 1
                                       FROM task_subscribers subscriber_filter
                                       WHERE subscriber_filter.task_id = _task_id
                                         AND subscriber_filter.user_id = u.id))

                  UNION ALL

                  -- Task subscribers (Notify feature), deduplicated below by user_id
                  SELECT ts.team_member_id,
                         pm.id AS project_member_id,
                         COALESCE((SELECT name
                                   FROM team_member_info_view
                                   WHERE team_member_info_view.team_member_id = tm.id), '') AS name,
                         COALESCE((SELECT email_notifications_enabled
                                   FROM notification_settings
                                   WHERE team_id = tm.team_id
                                     AND notification_settings.user_id = u.id), false) AS email_notifications_enabled,
                         COALESCE(u.avatar_url, '') AS avatar_url,
                         u.id AS user_id,
                         COALESCE(u.email, '') AS email,
                         COALESCE(u.socket_id, '') AS socket_id,
                         tm.team_id AS team_id
                  FROM task_subscribers ts
                           INNER JOIN team_members tm ON tm.id = ts.team_member_id
                           LEFT JOIN users u ON u.id = ts.user_id
                           INNER JOIN project_members pm
                                    ON pm.team_member_id = tm.id
                                        AND pm.project_id = (SELECT project_id FROM tasks WHERE id = _task_id)
                  WHERE ts.task_id = _task_id
                    AND _include_subscribers
                    AND u.is_deleted IS NOT TRUE
              ) combined
              ORDER BY user_id) rec
        INTO _output;

        RETURN _output;
    END;
    $$;
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION handle_on_task_status_change(_user_id uuid, _task_id uuid, _status_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _updater_name         TEXT;
        _task_name            TEXT;
        _previous_status_id   UUID;
        _previous_status_name TEXT;
        _new_status_name      TEXT;
        _message              TEXT;
        _task_info            JSON;
        _status_category      JSON;
        _schedule_id          JSON;
        _task_completed_at    TIMESTAMPTZ;
        _is_new_status_done   BOOLEAN;
        _members              JSON;
    BEGIN
        SELECT COALESCE(name, '') FROM tasks WHERE id = _task_id INTO _task_name;

        -- Get previous status ID and name
        SELECT t.status_id, COALESCE(ts.name, '')
        FROM tasks t
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        WHERE t.id = _task_id
        INTO _previous_status_id, _previous_status_name;

        SELECT COALESCE(name, '') FROM task_statuses WHERE id = _status_id INTO _new_status_name;

        -- Check if the new status is in a "done" category
        SELECT EXISTS(
            SELECT 1
            FROM sys_task_status_categories
            WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)
              AND is_done IS TRUE
        ) INTO _is_new_status_done;

        -- Update if status ID has changed
        IF (_previous_status_id IS DISTINCT FROM _status_id)
        THEN
            -- Update status_id and completed_at in a single statement
            -- Set completed_at based on whether the new status is "done"
            UPDATE tasks
            SET status_id    = _status_id,
                completed_at = CASE
                                   WHEN _is_new_status_done THEN CURRENT_TIMESTAMP
                                   ELSE NULL
                    END
            WHERE id = _task_id;

            SELECT get_task_complete_info(_task_id, _status_id) INTO _task_info;

            SELECT COALESCE(name, '') FROM users WHERE id = _user_id INTO _updater_name;

            _message = CONCAT(_updater_name, ' transitioned "', _task_name, '" from ', _previous_status_name, ' ⟶ ',
                              _new_status_name);

            -- Done transitions use the dedicated task-completion subscriber fanout,
            -- so subscribers are excluded here to avoid duplicate in-app notifications.
            SELECT get_task_notify_recipients(_task_id, NOT _is_new_status_done) INTO _members;
        END IF;

        SELECT completed_at FROM tasks WHERE id = _task_id INTO _task_completed_at;

        -- Handle schedule_id properly for recurring tasks
        SELECT CASE
                   WHEN schedule_id IS NULL THEN 'null'::json
                   ELSE json_build_object('id', schedule_id)
            END
        FROM tasks
        WHERE id = _task_id
        INTO _schedule_id;

        SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
        FROM (SELECT is_done, is_doing, is_todo
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)) r
        INTO _status_category;

        RETURN JSON_BUILD_OBJECT(
                'message', COALESCE(_message, ''),
                'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
                'parent_done', (CASE
                                    WHEN EXISTS(SELECT 1
                                                FROM tasks_with_status_view
                                                WHERE tasks_with_status_view.task_id = _task_id
                                                  AND is_done IS TRUE) THEN 1
                                    ELSE 0 END),
                'color_code', COALESCE((_task_info ->> 'color_code')::TEXT, ''),
                'color_code_dark', COALESCE((_task_info ->> 'color_code_dark')::TEXT, ''),
                'total_tasks', COALESCE((_task_info ->> 'total_tasks')::INT, 0),
                'total_completed', COALESCE((_task_info ->> 'total_completed')::INT, 0),
                'members', COALESCE(_members, '[]'::JSON),
                'completed_at', _task_completed_at,
                'status_category', COALESCE(_status_category, '{}'::JSON),
                'schedule_id', COALESCE(_schedule_id, 'null'::JSON)
               );
    END
    $$;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION handle_on_task_status_change(_user_id uuid, _task_id uuid, _status_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _updater_name         TEXT;
        _task_name            TEXT;
        _previous_status_id   UUID;
        _previous_status_name TEXT;
        _new_status_name      TEXT;
        _message              TEXT;
        _task_info            JSON;
        _status_category      JSON;
        _schedule_id          JSON;
        _task_completed_at    TIMESTAMPTZ;
        _is_new_status_done   BOOLEAN;
    BEGIN
        SELECT COALESCE(name, '') FROM tasks WHERE id = _task_id INTO _task_name;

        SELECT t.status_id, COALESCE(ts.name, '')
        FROM tasks t
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        WHERE t.id = _task_id
        INTO _previous_status_id, _previous_status_name;

        SELECT COALESCE(name, '') FROM task_statuses WHERE id = _status_id INTO _new_status_name;

        SELECT EXISTS(
            SELECT 1
            FROM sys_task_status_categories
            WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)
              AND is_done IS TRUE
        ) INTO _is_new_status_done;

        IF (_previous_status_id IS DISTINCT FROM _status_id)
        THEN
            UPDATE tasks
            SET status_id    = _status_id,
                completed_at = CASE
                                   WHEN _is_new_status_done THEN CURRENT_TIMESTAMP
                                   ELSE NULL
                    END
            WHERE id = _task_id;

            SELECT get_task_complete_info(_task_id, _status_id) INTO _task_info;

            SELECT COALESCE(name, '') FROM users WHERE id = _user_id INTO _updater_name;

            _message = CONCAT(_updater_name, ' transitioned "', _task_name, '" from ', _previous_status_name, ' ⟶ ',
                              _new_status_name);
        END IF;

        SELECT completed_at FROM tasks WHERE id = _task_id INTO _task_completed_at;

        SELECT CASE
                   WHEN schedule_id IS NULL THEN 'null'::json
                   ELSE json_build_object('id', schedule_id)
            END
        FROM tasks
        WHERE id = _task_id
        INTO _schedule_id;

        SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
        FROM (SELECT is_done, is_doing, is_todo
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)) r
        INTO _status_category;

        RETURN JSON_BUILD_OBJECT(
                'message', COALESCE(_message, ''),
                'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
                'parent_done', (CASE
                                    WHEN EXISTS(SELECT 1
                                                FROM tasks_with_status_view
                                                WHERE tasks_with_status_view.task_id = _task_id
                                                  AND is_done IS TRUE) THEN 1
                                    ELSE 0 END),
                'color_code', COALESCE((_task_info ->> 'color_code')::TEXT, ''),
                'color_code_dark', COALESCE((_task_info ->> 'color_code_dark')::TEXT, ''),
                'total_tasks', COALESCE((_task_info ->> 'total_tasks')::INT, 0),
                'total_completed', COALESCE((_task_info ->> 'total_completed')::INT, 0),
                'members', COALESCE((_task_info ->> 'members')::JSON, '[]'::JSON),
                'completed_at', _task_completed_at,
                'status_category', COALESCE(_status_category, '{}'::JSON),
                'schedule_id', COALESCE(_schedule_id, 'null'::JSON)
               );
    END
    $$;
  `);

  pgm.sql(`DROP FUNCTION IF EXISTS get_task_notify_recipients(uuid, boolean);`);
};
