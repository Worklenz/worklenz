"use strict";

/**
 * Fix toggle_archive_all_projects so team archiving/restoring keys off
 * projects.archived_for_team instead of the presence of personal archived_projects rows.
 *
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION toggle_archive_all_projects(_project_id uuid) RETURNS void
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _user_id UUID;
        _is_archived BOOLEAN;
    BEGIN
        SELECT COALESCE(archived_for_team, FALSE) INTO _is_archived FROM projects WHERE id = _project_id;

        IF _is_archived IS TRUE
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
                        VALUES (_user_id, _project_id)
                        ON CONFLICT (user_id, project_id) DO NOTHING;
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
exports.down = (pgm) => {
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
