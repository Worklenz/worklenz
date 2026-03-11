'use strict';
// Converted from: database/migrations/user_deletion_logs.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- CREATE TABLE IF NOT EXISTS for tracking user deletion requests
CREATE TABLE IF NOT EXISTS user_deletion_logs (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    scheduled_deletion_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deletion_completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE user_deletion_logs
    ADD CONSTRAINT IF NOT EXISTS user_deletion_logs_pk
        PRIMARY KEY (id);

ALTER TABLE user_deletion_logs
    ADD CONSTRAINT IF NOT EXISTS user_deletion_logs_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- CREATE INDEX IF NOT EXISTS for faster queries
CREATE INDEX IF NOT EXISTS idx_user_deletion_logs_user_id ON user_deletion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deletion_logs_scheduled_deletion ON user_deletion_logs(scheduled_deletion_date) WHERE NOT deletion_completed;

-- Add comment for documentation
COMMENT ON TABLE user_deletion_logs IS 'Tracks user account deletion requests and their scheduled deletion dates';
COMMENT ON COLUMN user_deletion_logs.scheduled_deletion_date IS 'Date when the user data should be permanently deleted (30 days after request)';
COMMENT ON COLUMN user_deletion_logs.deletion_completed IS 'Flag to indicate if the deletion process has been completed';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
