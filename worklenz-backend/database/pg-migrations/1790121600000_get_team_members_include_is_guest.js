'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Include is_guest on get_team_members so Uploaded By / member selects can
-- group Team Members vs Guest Members without duplicate option values.
CREATE OR REPLACE FUNCTION get_team_members(_team_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             WITH mbers AS (SELECT team_members.id,
                                   tmiv.name AS name,
                                   tmiv.email,
                                   tmiv.avatar_url,
                                   team_members.user_id,
                                   COALESCE(team_members.is_guest, FALSE) AS is_guest,
                                   EXISTS(SELECT 1
                                          FROM project_members
                                          WHERE project_id = _project_id
                                            AND project_members.team_member_id = team_members.id) AS exists_in_project,
                                   0 AS usage,
                                   (CASE
                                       WHEN EXISTS (SELECT 1
                                                    FROM email_invitations
                                                    WHERE team_member_id = team_members.id) THEN TRUE
                                       ELSE FALSE
                                       END) AS is_pending
                            FROM team_members
                                     LEFT JOIN users u ON team_members.user_id = u.id
                                     LEFT JOIN team_member_info_view tmiv ON team_members.id = tmiv.team_member_id
                            WHERE team_members.team_id = _team_id
                              AND team_members.active IS TRUE
                            ORDER BY tmiv.name)
             SELECT id, name, user_id, email, avatar_url, usage, is_pending, is_guest
             FROM mbers
             ORDER BY exists_in_project DESC
             --
         ) rec;

    RETURN _result;
END;
$$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Historical SQL migration: no automatic rollback is available.
};
