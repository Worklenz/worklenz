'use strict';
// Converted from: database/migrations/20260210000000-create-project-files.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE TABLE IF NOT EXISTS project_files (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    size        BIGINT                   DEFAULT 0                  NOT NULL,
    type        TEXT                                                NOT NULL,
    project_id  UUID                                                NOT NULL,
    team_id     UUID                                                NOT NULL,
    uploaded_by UUID,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,

    CONSTRAINT project_files_pk
        PRIMARY KEY (id),

    CONSTRAINT project_files_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
        ON DELETE CASCADE,

    CONSTRAINT project_files_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
        ON DELETE CASCADE,

    CONSTRAINT project_files_uploaded_by_fk
        FOREIGN KEY (uploaded_by) REFERENCES users
        ON DELETE SET NULL,

    CONSTRAINT project_files_name_check
        CHECK (CHAR_LENGTH(name) <= 255)
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_team_id ON project_files(team_id);
CREATE INDEX IF NOT EXISTS idx_project_files_created_at ON project_files(created_at DESC);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
