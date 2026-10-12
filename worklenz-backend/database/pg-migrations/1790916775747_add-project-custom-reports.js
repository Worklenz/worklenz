'use strict';

/**
 * Migration: Saved custom report definitions for Software project Reports
 * Date: 2026-10-02
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS project_custom_reports (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id    UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      source        TEXT NOT NULL,
      metric        TEXT NOT NULL,
      group_by      TEXT NOT NULL,
      filter        TEXT NOT NULL DEFAULT 'all',
      visualization TEXT NOT NULL DEFAULT 'bar',
      visibility    TEXT NOT NULL DEFAULT 'project',
      created_by    UUID REFERENCES users (id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT project_custom_reports_name_length_check
        CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 100),
      CONSTRAINT project_custom_reports_source_check
        CHECK (source IN ('items', 'sprints', 'releases', 'time')),
      CONSTRAINT project_custom_reports_filter_check
        CHECK (filter IN ('all', 'active', 'bugs', 'blocked')),
      CONSTRAINT project_custom_reports_visualization_check
        CHECK (visualization IN ('bar', 'line', 'donut', 'table', 'kpi')),
      CONSTRAINT project_custom_reports_visibility_check
        CHECK (visibility IN ('project', 'private'))
    );

    CREATE INDEX IF NOT EXISTS project_custom_reports_project_id_index
      ON project_custom_reports (project_id);

    COMMENT ON TABLE project_custom_reports IS
      'Saved custom report definitions (source, metric, grouping, visualization) for Software projects.';
    COMMENT ON COLUMN project_custom_reports.visibility IS
      'project = visible to all project members; private = visible only to its creator.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS project_custom_reports_project_id_index;
    DROP TABLE IF EXISTS project_custom_reports;
  `);
};
