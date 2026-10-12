'use strict';
// Client Portal invoices and quotes keep the client's details as they were when the record was
// created (name, company, email, phone, address, contact person). A billing document should show
// the party it was issued to, so renaming or editing a client later no longer rewrites old
// invoices and quotes, and the PDF / preview / detail views read this snapshot first.
//
// Existing rows are backfilled from the client's current details. Safe to re-run.
//
// Requires 1790923539989_create_client_portal_quotes.js (adds columns to client_portal_quotes).

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_invoices
        ADD COLUMN IF NOT EXISTS client_snapshot_name TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_company_name TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_email TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_phone TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_address TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_contact_person TEXT;

    ALTER TABLE client_portal_quotes
        ADD COLUMN IF NOT EXISTS client_snapshot_name TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_company_name TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_email TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_phone TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_address TEXT,
        ADD COLUMN IF NOT EXISTS client_snapshot_contact_person TEXT;

    -- Backfill: only rows that have no snapshot yet.
    UPDATE client_portal_invoices i
    SET client_snapshot_name = c.name,
        client_snapshot_company_name = c.company_name,
        client_snapshot_email = c.email::TEXT,
        client_snapshot_phone = c.phone,
        client_snapshot_address = c.address,
        client_snapshot_contact_person = c.contact_person
    FROM clients c
    WHERE c.id = i.client_id
      AND i.client_snapshot_name IS NULL;

    UPDATE client_portal_quotes q
    SET client_snapshot_name = c.name,
        client_snapshot_company_name = c.company_name,
        client_snapshot_email = c.email::TEXT,
        client_snapshot_phone = c.phone,
        client_snapshot_address = c.address,
        client_snapshot_contact_person = c.contact_person
    FROM clients c
    WHERE c.id = q.client_id
      AND q.client_snapshot_name IS NULL;

    COMMENT ON COLUMN client_portal_invoices.client_snapshot_name IS
      'Client details (client_snapshot_*) as they were when the invoice was created; shown on the invoice instead of the live client record.';
    COMMENT ON COLUMN client_portal_quotes.client_snapshot_name IS
      'Client details (client_snapshot_*) as they were when the quote was created; shown on the quote instead of the live client record.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // The snapshots are lost; documents fall back to the client's current details.
  pgm.sql(`
    ALTER TABLE client_portal_quotes
        DROP COLUMN IF EXISTS client_snapshot_name,
        DROP COLUMN IF EXISTS client_snapshot_company_name,
        DROP COLUMN IF EXISTS client_snapshot_email,
        DROP COLUMN IF EXISTS client_snapshot_phone,
        DROP COLUMN IF EXISTS client_snapshot_address,
        DROP COLUMN IF EXISTS client_snapshot_contact_person;

    ALTER TABLE client_portal_invoices
        DROP COLUMN IF EXISTS client_snapshot_name,
        DROP COLUMN IF EXISTS client_snapshot_company_name,
        DROP COLUMN IF EXISTS client_snapshot_email,
        DROP COLUMN IF EXISTS client_snapshot_phone,
        DROP COLUMN IF EXISTS client_snapshot_address,
        DROP COLUMN IF EXISTS client_snapshot_contact_person;
  `);
};
