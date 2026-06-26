'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS priority_id UUID;

    DO $$
    DECLARE
      _medium_priority_id UUID;
    BEGIN
      SELECT id
      INTO _medium_priority_id
      FROM task_priorities
      WHERE name = 'Medium'
      LIMIT 1;

      IF _medium_priority_id IS NULL THEN
        RAISE EXCEPTION 'Medium task priority is required before setting project default priority';
      END IF;

      UPDATE projects
      SET priority_id = _medium_priority_id
      WHERE priority_id IS NULL;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'projects_priority_id_fk'
      ) THEN
        ALTER TABLE projects
          ADD CONSTRAINT projects_priority_id_fk
            FOREIGN KEY (priority_id) REFERENCES task_priorities(id);
      END IF;
    END
    $$;

    CREATE OR REPLACE FUNCTION set_project_default_priority_trigger_fn() RETURNS TRIGGER AS
    $$
    DECLARE
    BEGIN
      IF NEW.priority_id IS NULL THEN
        SELECT id
        FROM task_priorities
        WHERE name = 'Medium'
        LIMIT 1
        INTO NEW.priority_id;
      END IF;

      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS projects_default_priority_trigger ON projects;
    CREATE TRIGGER projects_default_priority_trigger
      BEFORE INSERT OR UPDATE OF priority_id
      ON projects
      FOR EACH ROW
    EXECUTE FUNCTION set_project_default_priority_trigger_fn();

    ALTER TABLE projects
      ALTER COLUMN priority_id SET NOT NULL;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS projects_default_priority_trigger ON projects;
    DROP FUNCTION IF EXISTS set_project_default_priority_trigger_fn();

    ALTER TABLE projects
      ALTER COLUMN priority_id DROP NOT NULL;
  `);
};
