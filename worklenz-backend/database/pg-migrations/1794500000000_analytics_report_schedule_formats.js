"use strict";

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Allow multiple export formats per analytics report schedule.
 * Migrates `format` VARCHAR → `formats` TEXT[].
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE analytics_report_schedules
  ADD COLUMN IF NOT EXISTS formats TEXT[];

UPDATE analytics_report_schedules
SET formats = ARRAY[format]::TEXT[]
WHERE formats IS NULL;

ALTER TABLE analytics_report_schedules
  ALTER COLUMN formats SET DEFAULT ARRAY['PDF']::TEXT[],
  ALTER COLUMN formats SET NOT NULL;

ALTER TABLE analytics_report_schedules
  DROP CONSTRAINT IF EXISTS analytics_report_schedules_format_chk;

ALTER TABLE analytics_report_schedules
  DROP COLUMN IF EXISTS format;

ALTER TABLE analytics_report_schedules
  ADD CONSTRAINT analytics_report_schedules_formats_chk
    CHECK (
      cardinality(formats) >= 1
      AND formats <@ ARRAY['PDF', 'CSV', 'Excel']::TEXT[]
    );
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
ALTER TABLE analytics_report_schedules
  ADD COLUMN IF NOT EXISTS format VARCHAR(16);

UPDATE analytics_report_schedules
SET format = COALESCE(formats[1], 'PDF')
WHERE format IS NULL;

ALTER TABLE analytics_report_schedules
  ALTER COLUMN format SET DEFAULT 'PDF',
  ALTER COLUMN format SET NOT NULL;

ALTER TABLE analytics_report_schedules
  DROP CONSTRAINT IF EXISTS analytics_report_schedules_formats_chk;

ALTER TABLE analytics_report_schedules
  DROP COLUMN IF EXISTS formats;

ALTER TABLE analytics_report_schedules
  ADD CONSTRAINT analytics_report_schedules_format_chk
    CHECK (format IN ('PDF', 'CSV', 'Excel'));
`);
};
