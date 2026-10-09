'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- 1. Add translation columns to user_notifications
    ALTER TABLE user_notifications
      ADD COLUMN IF NOT EXISTS message_key TEXT,
      ADD COLUMN IF NOT EXISTS message_params JSONB,
      ADD COLUMN IF NOT EXISTS notification_type_key TEXT;

    CREATE INDEX IF NOT EXISTS idx_user_notifications_message_key
      ON user_notifications(message_key);

    COMMENT ON COLUMN user_notifications.message_key IS 'i18n translation key for the notification message';
    COMMENT ON COLUMN user_notifications.message_params IS 'JSON object with interpolation parameters for translation';
    COMMENT ON COLUMN user_notifications.notification_type_key IS 'Notification type identifier for client-side routing';

    -- 2. Drop legacy 5-argument create_notification to avoid ambiguous overloading
    DROP FUNCTION IF EXISTS create_notification(uuid, uuid, uuid, uuid, text);

    -- 3. Create updated create_notification with support for translation keys and params
    CREATE OR REPLACE FUNCTION create_notification(
        _user_id UUID,
        _team_id UUID,
        _task_id UUID DEFAULT NULL,
        _project_id UUID DEFAULT NULL,
        _message TEXT DEFAULT NULL,
        _message_key TEXT DEFAULT NULL,
        _message_params JSONB DEFAULT NULL,
        _notification_type_key TEXT DEFAULT NULL
    ) RETURNS JSON
        LANGUAGE plpgsql
    AS
    $$
    BEGIN
        IF (_user_id IS NOT NULL AND _team_id IS NOT NULL AND (is_null_or_empty(_message) IS FALSE OR _message_key IS NOT NULL))
        THEN
            INSERT INTO user_notifications (
                message,
                user_id,
                team_id,
                task_id,
                project_id,
                message_key,
                message_params,
                notification_type_key
            )
            VALUES (
                TRIM(_message),
                _user_id,
                _team_id,
                _task_id,
                _project_id,
                _message_key,
                _message_params,
                _notification_type_key
            );
        END IF;

        RETURN JSON_BUILD_OBJECT(
            'project', (SELECT name FROM projects WHERE id = _project_id),
            'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
            'team', (SELECT name FROM teams WHERE id = _team_id)
        );
    END
    $$;

    -- 4. Update notify_task_assignment_update
    CREATE OR REPLACE FUNCTION notify_task_assignment_update(
        _type text,
        _reporter_id uuid,
        _task_id uuid,
        _user_id uuid,
        _team_id uuid
    ) RETURNS JSON
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _message               TEXT;
        _reporter_name         TEXT;
        _task_name             TEXT;
        _project_id            UUID;
        _message_key           TEXT;
        _message_params        JSONB;
        _notification_type_key TEXT;
    BEGIN
        IF (_reporter_id IS NOT NULL AND _task_id IS NOT NULL AND _user_id IS NOT NULL)
        THEN
            SELECT project_id FROM tasks WHERE id = _task_id INTO _project_id;
            SELECT team_id FROM projects WHERE id = _project_id INTO _team_id;

            INSERT INTO task_updates (type, reporter_id, task_id, user_id, team_id, project_id)
            VALUES (_type, _reporter_id, _task_id, _user_id, _team_id, (SELECT project_id FROM tasks WHERE id = _task_id));

            SELECT name FROM users WHERE id = _reporter_id INTO _reporter_name;
            SELECT name FROM tasks WHERE id = _task_id INTO _task_name;

            IF (_type = 'ASSIGN')
            THEN
                _message = CONCAT('<b>', _reporter_name, '</b> has assigned you in <b>', _task_name, '</b>');
                _message_key = 'notifications.taskAssigned';
                _notification_type_key = 'TASK_ASSIGNMENT';
            ELSE
                _message = CONCAT('<b>', _reporter_name, '</b> has removed you from <b>', _task_name, '</b>');
                _message_key = 'notifications.taskRemoved';
                _notification_type_key = 'TASK_UNASSIGN';
            END IF;

            _message_params = JSON_BUILD_OBJECT(
                'reporter', _reporter_name,
                'task', _task_name
            );

            PERFORM create_notification(
                _user_id,
                _team_id,
                _task_id,
                _project_id,
                _message,
                _message_key,
                _message_params,
                _notification_type_key
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

    -- 5. Update remove_team_member
    CREATE OR REPLACE FUNCTION remove_team_member(_id uuid, _user_id uuid, _team_id uuid) RETURNS JSON
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _removed_user_id   UUID;
        _removed_team_name TEXT;
        _message           TEXT;
        _message_key       TEXT;
        _message_params    JSONB;
    BEGIN
        SELECT user_id FROM team_members WHERE id = _id INTO _removed_user_id;
        SELECT name FROM teams WHERE id = _team_id INTO _removed_team_name;

        UPDATE users
        SET active_team = (SELECT id FROM teams WHERE user_id = _removed_user_id LIMIT 1)
        WHERE active_team = _team_id
          AND id = _removed_user_id;

        _message = CONCAT('You have been removed from <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> by <b>',
                   (SELECT name FROM users WHERE id = _user_id), '</b>');
        _message_key = 'notifications.removedFromTeam';
        _message_params = JSON_BUILD_OBJECT(
            'team', (SELECT name FROM teams WHERE id = _team_id),
            'user', (SELECT name FROM users WHERE id = _user_id)
        );

        PERFORM create_notification(
            _removed_user_id,
            _team_id,
            NULL,
            NULL,
            _message,
            _message_key,
            _message_params,
            'TEAM_MEMBER_REMOVED'
        );

        RETURN JSON_BUILD_OBJECT(
            'user_id', _removed_user_id
        );
    END
    $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    -- Restore callers before removing the translation-aware overload.
    CREATE OR REPLACE FUNCTION notify_task_assignment_update(_type text, _reporter_id uuid, _task_id uuid, _user_id uuid, _team_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _reporter_name TEXT;
        _task_name     TEXT;
        _message       TEXT;
        _project_id    UUID;
    BEGIN
        IF (is_null_or_empty(_task_id) IS FALSE) THEN
            SELECT name FROM users WHERE id = _reporter_id INTO _reporter_name;
            SELECT name FROM tasks WHERE id = _task_id INTO _task_name;
            SELECT project_id FROM tasks WHERE id = _task_id INTO _project_id;
            SELECT team_id FROM projects WHERE id = _project_id INTO _team_id;

            IF (_type = 'ASSIGN') THEN
                _message = CONCAT('<b>', _reporter_name, '</b> has assigned you in <b>', _task_name, '</b>');
            ELSE
                _message = CONCAT('<b>', _reporter_name, '</b> has removed you from <b>', _task_name, '</b>');
            END IF;

            PERFORM create_notification(_user_id, _team_id, _task_id, _project_id, _message);

            RETURN JSON_BUILD_OBJECT(
                'receiver_socket_id', (SELECT socket_id FROM users WHERE id = _user_id),
                'team', (SELECT name FROM teams WHERE id = _team_id),
                'team_id', _team_id,
                'project', (SELECT name FROM projects WHERE id = _project_id),
                'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
                'project_id', _project_id,
                'task_id', _task_id,
                'message', _message
            );
        END IF;

        RETURN NULL;
    END
    $$;

    CREATE OR REPLACE FUNCTION remove_team_member(_id uuid, _user_id uuid, _team_id uuid) RETURNS JSON
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _removed_user_id UUID;
        _removed_team_name TEXT;
    BEGIN
        SELECT user_id FROM team_members WHERE id = _id INTO _removed_user_id;
        SELECT name FROM teams WHERE id = _team_id INTO _removed_team_name;

        UPDATE users
        SET active_team = (SELECT id FROM teams WHERE user_id = _removed_user_id LIMIT 1)
        WHERE active_team = _team_id AND id = _removed_user_id;

        PERFORM create_notification(
            _removed_user_id, _team_id, NULL, NULL,
            CONCAT('You have been removed from <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> by <b>',
                   (SELECT name FROM users WHERE id = _user_id), '</b>')
        );

        RETURN JSON_BUILD_OBJECT('user_id', _removed_user_id);
    END
    $$;

    DROP FUNCTION IF EXISTS create_notification(uuid, uuid, uuid, uuid, text, text, jsonb, text);

    DROP INDEX IF EXISTS idx_user_notifications_message_key;

    ALTER TABLE user_notifications
      DROP COLUMN IF EXISTS message_key,
      DROP COLUMN IF EXISTS message_params,
      DROP COLUMN IF EXISTS notification_type_key;

    CREATE OR REPLACE FUNCTION create_notification(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid, _message text) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    BEGIN
        IF (_user_id IS NOT NULL AND _team_id IS NOT NULL AND is_null_or_empty(_message) IS FALSE)
        THEN
            INSERT INTO user_notifications (message, user_id, team_id, task_id, project_id)
            VALUES (TRIM(_message), _user_id, _team_id, _task_id, _project_id);
        END IF;

        RETURN JSON_BUILD_OBJECT(
            'project', (SELECT name FROM projects WHERE id = _project_id),
            'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
            'team', (SELECT name FROM teams WHERE id = _team_id)
        );
    END
    $$;
  `);
};
