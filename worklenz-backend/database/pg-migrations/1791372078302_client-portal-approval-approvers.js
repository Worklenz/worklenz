'use strict';
// Client Portal v2 Approvals: more than one approver per request.
//
// A request can name several client users as approvers; the first to decide settles it. Each named
// approver is one row here. client_portal_approvals.approver_contact_id / approver_name stay as the
// primary approver (first named) and the joined display names, so existing reads keep working.
//
// Names are snapshotted so history survives a removed client user.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_approval_approvers (
        id            UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        approval_id   UUID                     NOT NULL REFERENCES client_portal_approvals (id) ON DELETE CASCADE,
        contact_id    UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        contact_name  TEXT                     NOT NULL,
        position      INTEGER                  NOT NULL DEFAULT 0,
        created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_approval_approvers_uq UNIQUE (approval_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_approval_approvers_contact
        ON client_portal_approval_approvers (contact_id);

    -- Every existing request keeps its single approver.
    INSERT INTO client_portal_approval_approvers (approval_id, contact_id, contact_name, position)
    SELECT a.id, a.approver_contact_id, a.approver_name, 0
      FROM client_portal_approvals a
     WHERE a.approver_contact_id IS NOT NULL
    ON CONFLICT (approval_id, contact_id) DO NOTHING;

    COMMENT ON TABLE client_portal_approval_approvers IS
      'Client users named as approvers of an approval request. The first one to decide settles the request.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_approval_approvers;
  `);
};
