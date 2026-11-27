'use strict';

exports.up = async (pgm) => {
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS manual_team_switch_until TIMESTAMPTZ');
};

exports.down = async (pgm) => {
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS manual_team_switch_until');
};
