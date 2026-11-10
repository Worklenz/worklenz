'use strict';

exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_reference TEXT;
    ALTER TABLE projects ADD CONSTRAINT projects_reference_length_check
      CHECK (project_reference IS NULL OR (length(project_reference) BETWEEN 1 AND 200 AND project_reference = btrim(project_reference)));
    CREATE UNIQUE INDEX projects_team_reference_unique
      ON projects (team_id, lower(project_reference)) WHERE project_reference IS NOT NULL;

    CREATE FUNCTION create_project_with_reference(_body json) RETURNS json LANGUAGE plpgsql AS $$
    DECLARE _project json;
    BEGIN
      _project := create_project(_body);
      UPDATE projects SET project_reference = NULLIF(btrim(_body->>'project_reference'), '')
        WHERE id = (_project->>'id')::uuid AND team_id = (_body->>'team_id')::uuid;
      RETURN _project;
    END $$;

    CREATE FUNCTION update_project_with_reference(_body json) RETURNS json LANGUAGE plpgsql AS $$
    DECLARE _project json;
    BEGIN
      _project := update_project(_body);
      IF _body::jsonb ? 'project_reference' THEN
        UPDATE projects SET project_reference = NULLIF(btrim(_body->>'project_reference'), '')
          WHERE id = (_project->>'id')::uuid AND team_id = (_body->>'team_id')::uuid;
      END IF;
      RETURN _project;
    END $$;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP FUNCTION update_project_with_reference(json);
    DROP FUNCTION create_project_with_reference(json);
    DROP INDEX projects_team_reference_unique;
    ALTER TABLE projects DROP COLUMN project_reference;
  `);
};
