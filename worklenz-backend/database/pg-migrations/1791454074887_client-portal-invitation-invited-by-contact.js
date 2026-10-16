'use strict';
// Client Portal v2, client-facing app (#2520): a Client Admin can create an invite link for a
// colleague (Account > Organization), when the operator allows it.
//
// client_invitations.invited_by was NOT NULL and referenced users(id), because only staff ever
// invited. A Client Admin is a client_contacts row, not a users row, so the inviter is now either:
//   invited_by             the staff user (as before), or
//   invited_by_contact_id  the Client Admin who created the link.
// Exactly one of the two is set on new rows (the CHECK allows legacy rows that predate this).

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_invitations ALTER COLUMN invited_by DROP NOT NULL;

    ALTER TABLE client_invitations
        ADD COLUMN IF NOT EXISTS invited_by_contact_id UUID REFERENCES client_contacts (id) ON DELETE SET NULL;

    ALTER TABLE client_invitations DROP CONSTRAINT IF EXISTS client_invitations_inviter_check;
    ALTER TABLE client_invitations
        ADD CONSTRAINT client_invitations_inviter_check
        CHECK (invited_by IS NULL OR invited_by_contact_id IS NULL);

    COMMENT ON COLUMN client_invitations.invited_by_contact_id IS
      'The Client Admin who created this invitation link; NULL when staff (invited_by) created it.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Restoring NOT NULL needs a user on every row. Invitations created by a Client Admin have none,
  // so they are removed first: they are short-lived links and the invited contacts remain.
  pgm.sql(`
    DELETE FROM client_invitations WHERE invited_by IS NULL;
    ALTER TABLE client_invitations DROP CONSTRAINT IF EXISTS client_invitations_inviter_check;
    ALTER TABLE client_invitations DROP COLUMN IF EXISTS invited_by_contact_id;
    ALTER TABLE client_invitations ALTER COLUMN invited_by SET NOT NULL;
  `);
};
