'use strict';
// Client Portal v2 (#2504 Clients, Users & Access).
//
// Evolves client_contacts (the v1 "company users") into the v2 client-user record rather than
// adding a parallel users table:
//   - role: poc / member  ->  admin / member / viewer (one role per user, applied to every project)
//   - lifecycle columns for the new statuses (Invited / Active / Deactivated) and the flags the
//     admin console shows (email not verified, asked for a new link)
//   - client_contact_project_access becomes a plain project assignment; permission_level is no
//     longer used (kept nullable so this migration is reversible)
//
// Portal status stays derived, not stored (see services/client-contacts-service.ts): disabled_at
// = Deactivated, so re-enabling a user restores whatever Invited / Active state their invitation
// and login imply. That is exactly the "reactivate restores the prior status" rule.
//
// v1 -> v2 role mapping (never upgrades privilege):
//   poc                                              -> admin
//   member with any comment / contributor access     -> member
//   member with view-only or no access rows          -> viewer

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_contacts DROP CONSTRAINT IF EXISTS client_contacts_role_check;

    UPDATE client_contacts cc
       SET role = CASE
             WHEN cc.role = 'poc' THEN 'admin'
             WHEN EXISTS (
                    SELECT 1
                      FROM client_contact_project_access a
                     WHERE a.client_contact_id = cc.id
                       AND a.permission_level IN ('comment', 'contributor')
                  ) THEN 'member'
             ELSE 'viewer'
           END,
           updated_at = CURRENT_TIMESTAMP
     WHERE cc.role IN ('poc', 'member');

    ALTER TABLE client_contacts
        ADD CONSTRAINT client_contacts_role_check CHECK (role IN ('admin', 'member', 'viewer'));

    ALTER TABLE client_contacts
        ADD COLUMN IF NOT EXISTS email_verified_at     TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS activated_at          TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS new_link_requested_at TIMESTAMP WITH TIME ZONE;

    -- A contact already linked to a login accepted an emailed invitation, which proves the address.
    -- v1 had no separate verification step, so those users count as verified and activated.
    UPDATE client_contacts cc
       SET email_verified_at = COALESCE(
                 (SELECT MAX(i.accepted_at) FROM client_invitations i WHERE i.client_contact_id = cc.id),
                 cc.created_at),
           activated_at = COALESCE(
                 (SELECT MAX(i.accepted_at) FROM client_invitations i WHERE i.client_contact_id = cc.id),
                 cc.created_at)
     WHERE cc.client_user_id IS NOT NULL
       AND cc.email_verified_at IS NULL;

    -- Assignments no longer carry a level.
    ALTER TABLE client_contact_project_access ALTER COLUMN permission_level DROP NOT NULL;

    COMMENT ON COLUMN client_contacts.role IS
      'v2 client role: admin (Client Admin), member (Client Member) or viewer (Client Viewer). One role per user.';
    COMMENT ON COLUMN client_contacts.email_verified_at IS
      'When the user confirmed the invited email with a one-time code. Null while the row shows "email not verified".';
    COMMENT ON COLUMN client_contacts.new_link_requested_at IS
      'Set when the client asks for a new link from the expired-invitation screen; cleared when staff resend.';
    COMMENT ON COLUMN client_contact_project_access.permission_level IS
      'Retired in v2 (roles replace per-project levels). Nullable and ignored; kept so the migration is reversible.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Lossy by design: v2 has three roles and v1 had two, so viewers fall back to member.
  // WARNING: that RAISES a viewer's privileges (a member can comment, upload and submit requests in v1).
  // v1 has no read-only role, so there is nothing safe to map to. Before rolling back, review the client
  // users that were Viewers (docs/client-portal-v2-rollout.md) and deactivate any that must stay read-only.
  pgm.sql(`
    ALTER TABLE client_contacts DROP CONSTRAINT IF EXISTS client_contacts_role_check;

    UPDATE client_contacts
       SET role = CASE WHEN role = 'admin' THEN 'poc' ELSE 'member' END,
           updated_at = CURRENT_TIMESTAMP
     WHERE role IN ('admin', 'member', 'viewer');

    ALTER TABLE client_contacts
        ADD CONSTRAINT client_contacts_role_check CHECK (role IN ('poc', 'member'));

    ALTER TABLE client_contacts
        DROP COLUMN IF EXISTS new_link_requested_at,
        DROP COLUMN IF EXISTS activated_at,
        DROP COLUMN IF EXISTS email_verified_at;

    UPDATE client_contact_project_access SET permission_level = 'view' WHERE permission_level IS NULL;
    ALTER TABLE client_contact_project_access ALTER COLUMN permission_level SET NOT NULL;

    COMMENT ON COLUMN client_contact_project_access.permission_level IS NULL;
  `);
};
