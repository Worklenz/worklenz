'use strict';
exports.up = (pgm) => pgm.sql(`
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE TABLE self_hosted_telemetry_state (
    installation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton),
    last_attempt_at TIMESTAMPTZ NOT NULL
  );
`);
exports.down = (pgm) => pgm.sql('DROP TABLE self_hosted_telemetry_state');
