'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE team_members
      ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

    UPDATE team_members tm
    SET is_guest = TRUE
    WHERE EXISTS (
      SELECT 1
      FROM project_members pm
      JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
      JOIN projects p ON p.id = pm.project_id
      WHERE pm.team_member_id = tm.id
        AND p.team_id = tm.team_id
        AND pal.key = 'GUEST'
    );

    CREATE OR REPLACE FUNCTION sync_team_member_guest_status() RETURNS TRIGGER
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _team_member_id UUID;
    BEGIN
        _team_member_id = COALESCE(NEW.team_member_id, OLD.team_member_id);

        UPDATE team_members
        SET is_guest = EXISTS(
            SELECT 1
            FROM project_members pm
            JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
            JOIN projects p ON p.id = pm.project_id
            WHERE pm.team_member_id = _team_member_id
              AND p.team_id = team_members.team_id
              AND pal.key = 'GUEST'
        )
        WHERE id = _team_member_id;

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
    END
    $$;

    DROP TRIGGER IF EXISTS trigger_sync_team_member_guest_status ON project_members;
    CREATE TRIGGER trigger_sync_team_member_guest_status
    AFTER INSERT OR UPDATE OF project_access_level_id, project_id, team_member_id OR DELETE
    ON project_members
    FOR EACH ROW
    EXECUTE FUNCTION sync_team_member_guest_status();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trigger_sync_team_member_guest_status ON project_members;
    DROP FUNCTION IF EXISTS sync_team_member_guest_status();
  `);
  pgm.dropColumns('team_members', ['is_guest'], { ifExists: true });
};