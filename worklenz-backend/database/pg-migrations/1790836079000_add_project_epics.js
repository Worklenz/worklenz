'use strict';

/**
 * Migration: Add project-level Epics for Software projects and link tasks to an Epic
 * Date: 2026-09-29
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS project_epics (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id  UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      color_code  TEXT NOT NULL DEFAULT '#722ed1',
      owner_id    UUID REFERENCES team_members (id) ON DELETE SET NULL,
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      sort_index  INTEGER NOT NULL DEFAULT 0,
      created_by  UUID REFERENCES users (id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT project_epics_name_length_check
        CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 100),
      CONSTRAINT project_epics_description_length_check
        CHECK (description IS NULL OR CHAR_LENGTH(description) <= 1000),
      CONSTRAINT project_epics_color_code_check
        CHECK (color_code ~ '^#[0-9A-Fa-f]{6}$')
    );

    CREATE INDEX IF NOT EXISTS project_epics_project_id_index
      ON project_epics (project_id);

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES project_epics (id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS tasks_epic_id_index
      ON tasks (epic_id)
      WHERE epic_id IS NOT NULL;

    COMMENT ON TABLE project_epics IS
      'Larger delivery outcomes that group related issues in a Software project.';
    COMMENT ON COLUMN tasks.epic_id IS
      'Parent Epic of the task (software projects). NULL when the task has no Epic.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS tasks_epic_id_index;
    ALTER TABLE tasks DROP COLUMN IF EXISTS epic_id;
    DROP TABLE IF EXISTS project_epics;
  `);
};
