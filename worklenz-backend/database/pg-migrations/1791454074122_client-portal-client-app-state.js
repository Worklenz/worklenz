'use strict';
// Client Portal v2, client-facing app (#2520): per-person state that the staff-only tables could
// not hold.
//
//   client_portal_thread_client_reads   a client user's own "read up to here" mark per discussion
//                                        thread, so the sidebar badge and the unread dot are per person.
//                                        (client_portal_thread_reads is the staff side, keyed by user.)
//   client_portal_notification_reads    a client user's own read state per notification. A client
//                                        notification row is created once per organization event; who it
//                                        reaches is decided at read time (project access, named approver),
//                                        so "read" has to be stored per person too.
//   client_contact_notification_prefs   which events a client user wants emailed. In-app is always on.
//                                        A missing row means "email on" (the operator's per-event switch
//                                        still decides whether that event is offered at all).
//
// Notifications are scoped at read time by the project the event is about, so a project index on
// the metadata keeps that filter cheap.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS client_portal_thread_client_reads (
        thread_id    UUID                     NOT NULL REFERENCES client_portal_threads (id) ON DELETE CASCADE,
        contact_id   UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (thread_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_thread_client_reads_contact
        ON client_portal_thread_client_reads (contact_id);

    CREATE TABLE IF NOT EXISTS client_portal_notification_reads (
        notification_id UUID                     NOT NULL REFERENCES client_portal_notifications (id) ON DELETE CASCADE,
        contact_id      UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        read_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (notification_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_notification_reads_contact
        ON client_portal_notification_reads (contact_id);

    CREATE TABLE IF NOT EXISTS client_contact_notification_prefs (
        contact_id UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        event_type TEXT                     NOT NULL,
        email      BOOLEAN                  NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (contact_id, event_type),
        CONSTRAINT client_contact_notification_prefs_event_check
            CHECK (event_type IN ('approval_request', 'comment_or_reply', 'file_shared', 'milestone_change',
                                  'project_update', 'change_request_update', 'access_changes'))
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_notifications_project
        ON client_portal_notifications ((metadata ->> 'project_id'));

    COMMENT ON TABLE client_portal_thread_client_reads IS
      'Per client user: when they last opened each discussion thread. A thread is unread while it holds a client-visible message from someone else newer than this.';
    COMMENT ON TABLE client_portal_notification_reads IS
      'Per client user read state for client_portal_notifications. No row = unread.';
    COMMENT ON TABLE client_contact_notification_prefs IS
      'Per client user email preference per event. In-app notifications are always on; no row = email on.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_client_portal_notifications_project;
    DROP TABLE IF EXISTS client_contact_notification_prefs;
    DROP TABLE IF EXISTS client_portal_notification_reads;
    DROP TABLE IF EXISTS client_portal_thread_client_reads;
  `);
};
