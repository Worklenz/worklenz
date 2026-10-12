'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- in_organization() previously compared teams.user_id (the owning account of each
-- team), so it only returned true when both teams were created by the exact same
-- user. Teams that belong to the same organization but are owned by a different
-- team member (e.g. a teammate's team, or a team transferred to another owner)
-- share the same teams.organization_id but not the same teams.user_id, so
-- organization-scoped sharing (task templates, project templates) incorrectly
-- failed with "not found" for those teams. Compare organization_id instead.
CREATE OR REPLACE FUNCTION in_organization(_team_id_in uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM teams t1
        JOIN teams t2 ON t1.organization_id = t2.organization_id
        WHERE t1.id = _team_id_in
          AND t2.id = _team_id
          AND t1.organization_id IS NOT NULL
    );
END;
$$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // manual rollback
};
