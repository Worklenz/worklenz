"use strict";

/**
 * Portal visibility follows a team archive flag, not the current role of whoever
 * has a row in archived_projects. Archive-for-team sets the flag; restore-for-team clears it.
 *
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS archived_for_team BOOLEAN NOT NULL DEFAULT FALSE;

    -- Freeze the archive state this release already treated as a team close-out.
    -- Later role or membership changes must not reopen or hide the project.
    UPDATE projects p
       SET archived_for_team = TRUE
     WHERE EXISTS (
       SELECT 1
         FROM archived_projects ap
         JOIN team_members tm
           ON tm.user_id = ap.user_id
          AND tm.team_id = p.team_id
          AND tm.active IS TRUE
         JOIN roles r ON r.id = tm.role_id
        WHERE ap.project_id = p.id
          AND (r.owner IS TRUE OR r.admin_role IS TRUE)
     );

    CREATE OR REPLACE FUNCTION toggle_archive_all_projects(_project_id uuid) RETURNS void
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _user_id UUID;
    BEGIN
        IF EXISTS(SELECT project_id FROM archived_projects WHERE project_id = _project_id)
        THEN
            DELETE FROM archived_projects WHERE project_id = _project_id;
            UPDATE projects SET archived_for_team = FALSE WHERE id = _project_id;
        ELSE
            FOR _user_id IN
                SELECT user_id FROM team_members WHERE team_id = (SELECT team_id FROM projects WHERE id = _project_id)
                LOOP
                    IF NOT (is_null_or_empty(_user_id))
                    THEN
                        INSERT INTO archived_projects (user_id, project_id)
                        VALUES (_user_id, _project_id);
                    END IF;
                END LOOP;
            UPDATE projects SET archived_for_team = TRUE WHERE id = _project_id;
        END IF;
    END
    $$;
  `);
};

/**
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.down = pgm => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION toggle_archive_all_projects(_project_id uuid) RETURNS void
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _user_id UUID;
    BEGIN
        IF EXISTS(SELECT project_id FROM archived_projects WHERE project_id = _project_id)
        THEN
            DELETE FROM archived_projects WHERE project_id = _project_id;
        ELSE
            FOR _user_id IN
                SELECT user_id FROM team_members WHERE team_id = (SELECT team_id FROM projects WHERE id = _project_id)
                LOOP
                    IF NOT (is_null_or_empty(_user_id))
                    THEN
                        INSERT INTO archived_projects (user_id, project_id)
                        VALUES (_user_id, _project_id);
                    END IF;
                END LOOP;
        END IF;
    END
    $$;

    ALTER TABLE projects DROP COLUMN IF EXISTS archived_for_team;
  `);
};
