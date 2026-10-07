'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
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
        _message_params = JSONB_BUILD_OBJECT(
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

        DELETE FROM team_members WHERE id = _id AND team_id = _team_id;

        RETURN JSON_BUILD_OBJECT(
            'id', _removed_user_id,
            'user_id', _removed_user_id,
            'team', _removed_team_name,
            'socket_id', (SELECT socket_id FROM users WHERE id = _removed_user_id)
        );
    END
    $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
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
        _message_params = JSONB_BUILD_OBJECT(
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
