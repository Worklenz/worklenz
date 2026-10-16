'use strict';

/**
 * Migration: Add project releases (versions) for Software projects and link tasks to a release
 * Date: 2026-10-01
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS project_releases (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id  UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      target_date DATE,
      status      TEXT NOT NULL DEFAULT 'unreleased',
      released_at TIMESTAMPTZ,
      created_by  UUID REFERENCES users (id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT project_releases_name_length_check
        CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 50),
      CONSTRAINT project_releases_description_length_check
        CHECK (description IS NULL OR CHAR_LENGTH(description) <= 1000),
      CONSTRAINT project_releases_status_check
        CHECK (status IN ('unreleased', 'released'))
    );

    CREATE INDEX IF NOT EXISTS project_releases_project_id_index
      ON project_releases (project_id);

    CREATE UNIQUE INDEX IF NOT EXISTS project_releases_project_name_unique
      ON project_releases (project_id, LOWER(TRIM(name)));

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES project_releases (id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS tasks_release_id_index
      ON tasks (release_id)
      WHERE release_id IS NOT NULL;

    COMMENT ON TABLE project_releases IS
      'Versions that group features and fixes shipped together in a Software project.';
    COMMENT ON COLUMN tasks.release_id IS
      'Release (fix version) the task ships in (software projects). NULL when unplanned.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS tasks_release_id_index;
    ALTER TABLE tasks DROP COLUMN IF EXISTS release_id;
    DROP INDEX IF EXISTS project_releases_project_name_unique;
    DROP TABLE IF EXISTS project_releases;
  `);
};
