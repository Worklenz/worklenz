'use strict';
// Client Portal v2, client-facing app (#2520): Settings > Danger zone > Delete account.
//
// A client user's account deletion follows the main app's rules: a soft delete (the login is flagged,
// nothing is removed), a 30-day window, then support removes the data by hand. This adds:
//
//   client_users.deleted_at           the soft-delete flag. Production code already reads it (an Active
//                                     client user needs it NULL); IF NOT EXISTS makes this safe where
//                                     the column was created outside the migrations.
//   client_user_deletion_logs         the purge queue, like user_deletion_logs for staff. There is no
//                                     foreign key to client_users on purpose: the log must outlive the
//                                     login row it describes once support purges it.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

    CREATE TABLE IF NOT EXISTS client_user_deletion_logs (
        id                      UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_user_id          UUID                     NOT NULL,
        email                   TEXT                     NOT NULL,
        name                    TEXT                     NOT NULL,
        requested_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        scheduled_deletion_date TIMESTAMP WITH TIME ZONE NOT NULL,
        deleted_at              TIMESTAMP WITH TIME ZONE,
        deletion_completed      BOOLEAN                  NOT NULL DEFAULT FALSE,
        created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_user_deletion_logs_client_user
        ON client_user_deletion_logs (client_user_id);
    CREATE INDEX IF NOT EXISTS idx_client_user_deletion_logs_scheduled
        ON client_user_deletion_logs (scheduled_deletion_date) WHERE NOT deletion_completed;

    COMMENT ON TABLE client_user_deletion_logs IS
      'Client portal account deletion requests and the date their data should be permanently removed.';
    COMMENT ON COLUMN client_user_deletion_logs.scheduled_deletion_date IS
      'Date the data should be permanently removed (30 days after the request).';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // client_users.deleted_at is left in place: sign-in and access checks already depend on it.
  pgm.sql(`
    DROP TABLE IF EXISTS client_user_deletion_logs;
  `);
};
