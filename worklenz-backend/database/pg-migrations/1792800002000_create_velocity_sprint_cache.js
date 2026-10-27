"use strict";

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Phase 2 Velocity Charts: per-sprint velocity cache + template defaults.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS velocity_sprint_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id UUID NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  sprint_name TEXT NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  committed_points DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed_points DOUBLE PRECISION NOT NULL DEFAULT 0,
  committed_issue_count INTEGER NOT NULL DEFAULT 0,
  completed_issue_count INTEGER NOT NULL DEFAULT 0,
  commitment_accuracy DOUBLE PRECISION,
  member_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (sprint_id)
);

CREATE INDEX IF NOT EXISTS idx_velocity_sprint_cache_team_completed
  ON velocity_sprint_cache(team_id, completed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_velocity_sprint_cache_project_completed
  ON velocity_sprint_cache(project_id, completed_at DESC NULLS LAST);

COMMENT ON TABLE velocity_sprint_cache IS
  'Cached committed/completed velocity per completed sprint for Reporting & Analytics.';

ALTER TABLE analytics_report_templates
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_report_templates_owner_kind_default
  ON analytics_report_templates(owner_id, report_kind)
  WHERE is_default IS TRUE;
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
DROP INDEX IF EXISTS idx_analytics_report_templates_owner_kind_default;
ALTER TABLE analytics_report_templates DROP COLUMN IF EXISTS is_default;
DROP TABLE IF EXISTS velocity_sprint_cache;
`);
};
