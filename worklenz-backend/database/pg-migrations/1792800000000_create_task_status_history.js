"use strict";

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Per-task status transition log for CFD and Time in Status (Phase 0 OQ-2).
 * entered_at / exited_at support duration queries; retain 24 months via nightly prune.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS task_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status_id UUID NOT NULL REFERENCES task_statuses(id) ON DELETE CASCADE,
  previous_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exited_at TIMESTAMPTZ,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id
  ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_project_entered
  ON task_status_history(project_id, entered_at);
CREATE INDEX IF NOT EXISTS idx_task_status_history_status_open
  ON task_status_history(status_id)
  WHERE exited_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_status_history_exited_at
  ON task_status_history(exited_at)
  WHERE exited_at IS NOT NULL;

COMMENT ON TABLE task_status_history IS
  'Status transition history for analytics (CFD / Time in Status). Retain 24 months.';
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS task_status_history;`);
};
