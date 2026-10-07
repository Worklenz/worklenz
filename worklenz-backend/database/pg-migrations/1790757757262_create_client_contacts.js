'use strict';
// Company Users for the Client Portal: client_contacts (one row per person at a client company)
// plus per-project access levels. A contact exists before that person has a login, so it lives
// outside client_users (which requires credentials and has a global UNIQUE email) — once the
// contact accepts an invitation, client_user_id points at their login row.
//
// Portal status is derived (see services/client-contacts-service.ts), not stored. Only
// disabled_at is stored, so re-enabling a contact restores whatever status the underlying
// invitation / login state implies.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS client_contacts (
        id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id        UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        client_id      UUID                     NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
        client_user_id UUID                     REFERENCES client_users (id) ON DELETE SET NULL,
        name           VARCHAR(255)             NOT NULL,
        email          VARCHAR(255)             NOT NULL,
        phone          VARCHAR(50),
        job_title      VARCHAR(100),
        role           VARCHAR(10)              NOT NULL DEFAULT 'member' CHECK (role IN ('poc', 'member')),
        disabled_at    TIMESTAMP WITH TIME ZONE,
        created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Login is unique per email globally, so a contact's email is unique per team.
    CREATE UNIQUE INDEX IF NOT EXISTS client_contacts_team_email_uindex
        ON client_contacts (team_id, lower(email));
    CREATE INDEX IF NOT EXISTS client_contacts_client_id_index
        ON client_contacts (client_id);
    -- A login can be a contact in several teams (multi-org), but only one contact per team.
    CREATE UNIQUE INDEX IF NOT EXISTS client_contacts_client_user_team_uindex
        ON client_contacts (client_user_id, team_id) WHERE client_user_id IS NOT NULL;

    -- Per-contact, per-project permission level. Stored and displayed only; the client-facing API
    -- still scopes by company (projects.client_id).
    CREATE TABLE IF NOT EXISTS client_contact_project_access (
        id                UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_contact_id UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        project_id        UUID                     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        permission_level  VARCHAR(20)              NOT NULL CHECK (permission_level IN ('view', 'comment', 'contributor')),
        created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_contact_project_access_uq UNIQUE (client_contact_id, project_id)
    );

    CREATE INDEX IF NOT EXISTS client_contact_project_access_project_id_index
        ON client_contact_project_access (project_id);

    -- Ties an invitation to the contact it was sent to, so the contact's portal status can be read
    -- from its own latest invitation.
    ALTER TABLE client_invitations
        ADD COLUMN IF NOT EXISTS client_contact_id UUID REFERENCES client_contacts (id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS client_invitations_client_contact_id_index
        ON client_invitations (client_contact_id);
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS client_invitations_client_contact_id_index;
    ALTER TABLE client_invitations DROP COLUMN IF EXISTS client_contact_id;
    DROP TABLE IF EXISTS client_contact_project_access;
    DROP TABLE IF EXISTS client_contacts;
  `);
};
