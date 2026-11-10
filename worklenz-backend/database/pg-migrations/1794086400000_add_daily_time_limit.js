'use strict';

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS enforce_daily_time_limit BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE organizations ALTER COLUMN enforce_daily_time_limit SET DEFAULT TRUE;
  `);
};

exports.down = async (pgm) => {
  pgm.sql('ALTER TABLE organizations DROP COLUMN IF EXISTS enforce_daily_time_limit;');
};
