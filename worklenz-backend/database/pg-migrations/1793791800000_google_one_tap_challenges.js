'use strict';

exports.up = pgm => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE TABLE google_one_tap_challenges (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_hash TEXT NOT NULL UNIQUE,
      nonce_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX google_one_tap_challenges_expiry_idx ON google_one_tap_challenges (expires_at);
    CREATE INDEX google_one_tap_users_google_id_idx ON users (google_id) WHERE google_id IS NOT NULL;
  `);
};

exports.down = pgm => {
  pgm.sql('DROP INDEX google_one_tap_users_google_id_idx;');
  pgm.dropTable('google_one_tap_challenges');
};
