'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION notify_task_assignment_update(
      _type text,
      _reporter_id uuid,
      _task_id uuid,
      _user_id uuid,
      _team_id uuid
    ) RETURNS json
    LANGUAGE plpgsql
    AS $$
    DECLARE
        _reporter_name         TEXT;
        _task_name             TEXT;
        _message               TEXT;
        _project_id            UUID;
        _message_key           TEXT;
        _message_params        JSONB;
        _notification_type_key TEXT;
    BEGIN
        IF (_reporter_id IS NOT NULL AND _task_id IS NOT NULL AND _user_id IS NOT NULL) THEN
            SELECT project_id FROM tasks WHERE id = _task_id INTO _project_id;
            SELECT team_id FROM projects WHERE id = _project_id INTO _team_id;

            INSERT INTO task_updates (type, reporter_id, task_id, user_id, team_id, project_id)
            VALUES (_type, _reporter_id, _task_id, _user_id, _team_id, (SELECT project_id FROM tasks WHERE id = _task_id));

            SELECT name FROM users WHERE id = _reporter_id INTO _reporter_name;
            SELECT name FROM tasks WHERE id = _task_id INTO _task_name;

            IF (_type = 'ASSIGN') THEN
                _message = CONCAT('<b>', _reporter_name, '</b> has assigned you to <b>', _task_name, '</b>');
                _message_key = 'notifications.taskAssigned';
                _notification_type_key = 'TASK_ASSIGNMENT';
            ELSE
                _message = CONCAT('<b>', _reporter_name, '</b> has removed you from <b>', _task_name, '</b>');
                _message_key = 'notifications.taskRemoved';
                _notification_type_key = 'TASK_UNASSIGN';
            END IF;

            _message_params = JSONB_BUILD_OBJECT('reporter', _reporter_name, 'task', _task_name);

            PERFORM create_notification(
                _user_id, _team_id, _task_id, _project_id, _message,
                _message_key, _message_params, _notification_type_key
            );

            RETURN JSON_BUILD_OBJECT(
                'receiver_socket_id', (SELECT socket_id FROM users WHERE id = _user_id),
                'team', (SELECT name FROM teams WHERE id = _team_id),
                'team_id', _team_id,
                'project', (SELECT name FROM projects WHERE id = _project_id),
                'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
                'project_id', _project_id,
                'task_id', _task_id,
                'message', _message,
                'message_key', _message_key,
                'message_params', _message_params,
                'notification_type_key', _notification_type_key
            );
        END IF;

        RETURN NULL;
    END
    $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION notify_task_assignment_update(
      _type text,
      _reporter_id uuid,
      _task_id uuid,
      _user_id uuid,
      _team_id uuid
    ) RETURNS json
    LANGUAGE plpgsql
    AS $$
    DECLARE
        _reporter_name         TEXT;
        _task_name             TEXT;
        _message               TEXT;
        _project_id            UUID;
        _message_key           TEXT;
        _message_params        JSONB;
        _notification_type_key TEXT;
    BEGIN
        IF (_reporter_id IS NOT NULL AND _task_id IS NOT NULL AND _user_id IS NOT NULL) THEN
            SELECT project_id FROM tasks WHERE id = _task_id INTO _project_id;
            SELECT team_id FROM projects WHERE id = _project_id INTO _team_id;
            INSERT INTO task_updates (type, reporter_id, task_id, user_id, team_id, project_id)
            VALUES (_type, _reporter_id, _task_id, _user_id, _team_id, (SELECT project_id FROM tasks WHERE id = _task_id));
            SELECT name FROM users WHERE id = _reporter_id INTO _reporter_name;
            SELECT name FROM tasks WHERE id = _task_id INTO _task_name;
            IF (_type = 'ASSIGN') THEN
                _message = CONCAT('<b>', _reporter_name, '</b> has assigned you in <b>', _task_name, '</b>');
                _message_key = 'notifications.taskAssigned';
                _notification_type_key = 'TASK_ASSIGNMENT';
            ELSE
                _message = CONCAT('<b>', _reporter_name, '</b> has removed you from <b>', _task_name, '</b>');
                _message_key = 'notifications.taskRemoved';
                _notification_type_key = 'TASK_UNASSIGN';
            END IF;
            _message_params = JSONB_BUILD_OBJECT('reporter', _reporter_name, 'task', _task_name);
            PERFORM create_notification(_user_id, _team_id, _task_id, _project_id, _message, _message_key, _message_params, _notification_type_key);
            RETURN JSON_BUILD_OBJECT(
                'receiver_socket_id', (SELECT socket_id FROM users WHERE id = _user_id),
                'team', (SELECT name FROM teams WHERE id = _team_id),
                'team_id', _team_id,
                'project', (SELECT name FROM projects WHERE id = _project_id),
                'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
                'project_id', _project_id,
                'task_id', _task_id,
                'message', _message,
                'message_key', _message_key,
                'message_params', _message_params,
                'notification_type_key', _notification_type_key
            );
        END IF;
        RETURN NULL;
    END
    $$;
  `);
};
