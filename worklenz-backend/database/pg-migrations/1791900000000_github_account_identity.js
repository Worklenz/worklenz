'use strict';

exports.up = pgm => {
  pgm.sql('ALTER TABLE github_integrations ADD COLUMN github_account_id BIGINT');
};

exports.down = pgm => {
  pgm.sql('ALTER TABLE github_integrations DROP COLUMN github_account_id');
};
