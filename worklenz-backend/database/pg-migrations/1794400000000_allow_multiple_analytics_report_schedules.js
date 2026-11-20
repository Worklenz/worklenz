"use strict";

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Allow multiple email schedules per report kind / template.
 * Previously unique on (owner_id, report_kind) and (owner_id, template_id)
 * limited each user to one schedule per report.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
DROP INDEX IF EXISTS idx_analytics_report_schedules_owner_kind_builtin;
DROP INDEX IF EXISTS idx_analytics_report_schedules_owner_template;

CREATE INDEX IF NOT EXISTS idx_analytics_report_schedules_owner_kind
  ON analytics_report_schedules(owner_id, report_kind);

CREATE INDEX IF NOT EXISTS idx_analytics_report_schedules_owner_template
  ON analytics_report_schedules(owner_id, template_id)
  WHERE template_id IS NOT NULL;
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
DROP INDEX IF EXISTS idx_analytics_report_schedules_owner_template;
DROP INDEX IF EXISTS idx_analytics_report_schedules_owner_kind;

-- Recreate prior uniqueness (keeps the earliest row per owner/kind or template).
DELETE FROM analytics_report_schedules a
USING analytics_report_schedules b
WHERE a.owner_id = b.owner_id
  AND a.template_id IS NULL
  AND b.template_id IS NULL
  AND a.report_kind = b.report_kind
  AND a.created_at > b.created_at;

DELETE FROM analytics_report_schedules a
USING analytics_report_schedules b
WHERE a.owner_id = b.owner_id
  AND a.template_id IS NOT NULL
  AND b.template_id IS NOT NULL
  AND a.template_id = b.template_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_report_schedules_owner_kind_builtin
  ON analytics_report_schedules(owner_id, report_kind)
  WHERE template_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_report_schedules_owner_template
  ON analytics_report_schedules(owner_id, template_id)
  WHERE template_id IS NOT NULL;
`);
};
