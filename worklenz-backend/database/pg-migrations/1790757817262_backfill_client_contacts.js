'use strict';
// Backfills client_contacts from the one-contact-per-client model that existed before
// client_contacts. Idempotent: every INSERT is ON CONFLICT DO NOTHING and every UPDATE only
// touches unlinked rows, so it is safe to re-run.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- 1. One POC per client that has an email. When the same email is on several clients in one
    --    team, the oldest client wins and the rest are skipped (reported below).
    INSERT INTO client_contacts (team_id, client_id, name, email, phone, role)
    SELECT DISTINCT ON (c.team_id, lower(c.email))
           c.team_id,
           c.id,
           LEFT(COALESCE(NULLIF(TRIM(c.contact_person), ''), c.name), 255),
           TRIM(c.email::TEXT),
           LEFT(NULLIF(TRIM(c.phone), ''), 50),
           'poc'
    FROM clients c
    WHERE c.email IS NOT NULL AND TRIM(c.email::TEXT) <> ''
    ORDER BY c.team_id, lower(c.email), c.created_at, c.id
    ON CONFLICT DO NOTHING;

    -- 2. Link each contact to its login row when the client already has one for that email.
    UPDATE client_contacts cc
    SET client_user_id = cu.id
    FROM client_users cu
    WHERE cc.client_user_id IS NULL
      AND cu.client_id = cc.client_id
      AND lower(cu.email) = lower(cc.email)
      AND NOT EXISTS (
        SELECT 1 FROM client_contacts x WHERE x.client_user_id = cu.id AND x.team_id = cc.team_id
      );

    -- 3. Remaining logins (someone other than the client's main email) become members.
    INSERT INTO client_contacts (team_id, client_id, name, email, role, client_user_id)
    SELECT c.team_id,
           cu.client_id,
           LEFT(COALESCE(NULLIF(TRIM(cu.name), ''), cu.email), 255),
           TRIM(cu.email),
           'member',
           cu.id
    FROM client_users cu
    JOIN clients c ON c.id = cu.client_id
    WHERE NOT EXISTS (
        SELECT 1 FROM client_contacts cc WHERE cc.client_user_id = cu.id AND cc.team_id = c.team_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM client_contacts cc
        WHERE cc.team_id = c.team_id AND lower(cc.email) = lower(cu.email)
      )
    ON CONFLICT DO NOTHING;

    -- 4. Tie existing invitations to their contact so status can be read per contact.
    UPDATE client_invitations ci
    SET client_contact_id = cc.id
    FROM client_contacts cc
    WHERE ci.client_contact_id IS NULL
      AND ci.client_id = cc.client_id
      AND lower(ci.email) = lower(cc.email);

    DO $$
    DECLARE
      skipped INTEGER;
    BEGIN
      SELECT COUNT(*) INTO skipped
      FROM clients c
      WHERE c.email IS NOT NULL AND TRIM(c.email::TEXT) <> ''
        AND NOT EXISTS (SELECT 1 FROM client_contacts cc WHERE cc.client_id = c.id);
      RAISE NOTICE 'client_contacts backfill: % client(s) skipped because their email is already a contact of another client in the same team', skipped;
    END $$;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async () => {
  // Data backfill only; not reversible (would require distinguishing backfilled rows from
  // contacts created afterward through the app).
};
