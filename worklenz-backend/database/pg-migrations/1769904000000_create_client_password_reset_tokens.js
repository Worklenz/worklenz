'use strict';
// Converted from: database/migrations/20260217000000-create-client-password-reset-tokens.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Create password reset tokens table specifically for client portal users
-- This avoids foreign key constraint issues with the main password_reset_tokens table
-- which references the users table, not client_users table

CREATE TABLE IF NOT EXISTS client_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_user_id UUID NOT NULL REFERENCES client_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_password_reset_tokens_client_user_id 
    ON client_password_reset_tokens(client_user_id);

CREATE INDEX IF NOT EXISTS idx_client_password_reset_tokens_token_hash 
    ON client_password_reset_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_client_password_reset_tokens_lookup 
    ON client_password_reset_tokens(token_hash, is_used, expires_at);

CREATE INDEX IF NOT EXISTS idx_client_password_reset_tokens_is_used 
    ON client_password_reset_tokens(is_used);

CREATE INDEX IF NOT EXISTS idx_client_password_reset_tokens_expires_at 
    ON client_password_reset_tokens(expires_at);

COMMENT ON TABLE client_password_reset_tokens IS 
    'Password reset tokens for client portal users (separate from main users table)';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
