'use strict';
// Client Portal v2: one-time-code sign-in.
//
// Client users no longer have a password and there is no sign-in configuration. A person signs in by
// receiving a 6-digit code at an email address the team (or a Client Admin) has added, either from the
// emailed invitation / magic link or by typing the address on the sign-in page.
//
// 1. client_login_codes: the codes. Only a keyed hash is stored, never the code itself. A row is
//    single use (consumed_at), expires after a few minutes and counts wrong attempts. A row is also
//    written for an address that has no portal access (with an unusable hash) so that throttling and
//    response timing look the same for every address and cannot be used to find out who has access.
//
// 2. client_users_auth_check required a Worklenz user link or a password hash on every login row.
//    A passwordless login has neither, so the check is dropped.
//
// 3. The sign-in settings columns that an earlier draft of this release added are removed. The
//    settings migration no longer creates them, so this only matters where it already ran.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_login_codes (
        id            UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        email         TEXT                     NOT NULL,
        code_hash     TEXT                     NOT NULL,
        invitation_id UUID                     REFERENCES client_invitations (id) ON DELETE SET NULL,
        attempts      INTEGER                  NOT NULL DEFAULT 0,
        expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
        consumed_at   TIMESTAMP WITH TIME ZONE,
        requested_ip  TEXT,
        created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_login_codes_email_lower_check CHECK (email = LOWER(email)),
        CONSTRAINT client_login_codes_attempts_check CHECK (attempts >= 0)
    );

    CREATE INDEX IF NOT EXISTS client_login_codes_email_created_idx
        ON client_login_codes (email, created_at DESC);
    CREATE INDEX IF NOT EXISTS client_login_codes_expires_idx
        ON client_login_codes (expires_at);

    COMMENT ON TABLE client_login_codes IS
      'One-time sign-in codes for client users. code_hash is an HMAC; rows are single use and short lived.';

    ALTER TABLE client_users DROP CONSTRAINT IF EXISTS client_users_auth_check;

    ALTER TABLE client_portal_settings
        DROP COLUMN IF EXISTS auth_magic_link,
        DROP COLUMN IF EXISTS auth_google,
        DROP COLUMN IF EXISTS auth_password,
        DROP COLUMN IF EXISTS mark_idle_invitations_expired;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // The check is restored NOT VALID: passwordless logins created since the up migration would fail a
  // validating check, and they must keep working until someone decides what to do with them.
  pgm.sql(`
    ALTER TABLE client_users
        ADD CONSTRAINT client_users_auth_check
        CHECK (user_id IS NOT NULL OR password_hash IS NOT NULL) NOT VALID;

    DROP TABLE IF EXISTS client_login_codes;
  `);
};
