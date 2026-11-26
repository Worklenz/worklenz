"use strict";

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Recurring email schedules for analytics reports.
 * Frequency fields mirror task_recurring_schedules (SCHEDULE_TYPE + day/interval
 * columns). send_time is report-specific (recurring tasks have no time-of-day).
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_type') THEN
    CREATE TYPE SCHEDULE_TYPE AS ENUM (
      'daily',
      'weekly',
      'yearly',
      'monthly',
      'every_x_days',
      'every_x_weeks',
      'every_x_months'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS analytics_report_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_kind VARCHAR(64) NOT NULL,
  report_name VARCHAR(120) NOT NULL,
  template_id UUID REFERENCES analytics_report_templates(id) ON DELETE CASCADE,

  -- Recurrence (same shape as task_recurring_schedules)
  schedule_type SCHEDULE_TYPE NOT NULL DEFAULT 'weekly'::SCHEDULE_TYPE,
  days_of_week INTEGER[],
  day_of_month INTEGER,
  date_of_month INTEGER,
  week_of_month INTEGER,
  interval_days INTEGER,
  interval_weeks INTEGER,
  interval_months INTEGER,

  -- Report schedules send at a clock time; recurring tasks do not
  send_time TIME NOT NULL DEFAULT '08:00',
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',

  recipients TEXT[] NOT NULL DEFAULT '{}',
  format VARCHAR(16) NOT NULL DEFAULT 'PDF',
  message TEXT,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  paused BOOLEAN NOT NULL DEFAULT FALSE,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT analytics_report_schedules_format_chk
    CHECK (format IN ('PDF', 'CSV', 'Excel')),
  CONSTRAINT analytics_report_schedules_recipients_chk
    CHECK (cardinality(recipients) >= 1)
);

COMMENT ON TABLE analytics_report_schedules IS
  'Email cadence for analytics reports. filters_json is fixed at save; export uses live data at send_time.';
COMMENT ON COLUMN analytics_report_schedules.filters_json IS
  'Filter snapshot from the report page when the schedule was saved.';
COMMENT ON COLUMN analytics_report_schedules.send_time IS
  'Local clock time in timezone when the live export should be emailed.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_report_schedules_owner_kind_builtin
  ON analytics_report_schedules(owner_id, report_kind)
  WHERE template_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_report_schedules_owner_template
  ON analytics_report_schedules(owner_id, template_id)
  WHERE template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_report_schedules_team
  ON analytics_report_schedules(team_id);

CREATE INDEX IF NOT EXISTS idx_analytics_report_schedules_due
  ON analytics_report_schedules(next_send_at)
  WHERE paused IS FALSE;
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
DROP INDEX IF EXISTS idx_analytics_report_schedules_due;
DROP INDEX IF EXISTS idx_analytics_report_schedules_team;
DROP INDEX IF EXISTS idx_analytics_report_schedules_owner_template;
DROP INDEX IF EXISTS idx_analytics_report_schedules_owner_kind_builtin;
DROP TABLE IF EXISTS analytics_report_schedules;
`);
};
