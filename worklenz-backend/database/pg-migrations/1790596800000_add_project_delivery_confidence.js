'use strict';
// Portfolio progress tracking.
// The only new stored data is a manual, per-project Delivery Confidence.
// Percent complete and blocked-task counts stay computed from existing task data.

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE TABLE IF NOT EXISTS project_delivery_confidence (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    project_id UUID                                                NOT NULL,
    status     TEXT,
    note       TEXT,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    CONSTRAINT project_delivery_confidence_pk PRIMARY KEY (id),
    CONSTRAINT project_delivery_confidence_project_id_unique UNIQUE (project_id),
    CONSTRAINT project_delivery_confidence_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT project_delivery_confidence_updated_by_fk
        FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT project_delivery_confidence_status_check
        CHECK (status IS NULL OR status IN ('green', 'amber', 'red')),
    CONSTRAINT project_delivery_confidence_note_check
        CHECK (note IS NULL OR CHAR_LENGTH(note) <= 280)
);

COMMENT ON TABLE project_delivery_confidence IS
    'Manual Delivery Confidence for a project. NULL status means Not set and must never be treated as On track. Owner reassignment does not clear this row.';

COMMENT ON COLUMN project_delivery_confidence.status IS
    'green = On track, amber = At risk, red = Off track. NULL = Not set.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
DROP TABLE IF EXISTS project_delivery_confidence;
  `);
};
