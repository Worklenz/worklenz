'use strict';
// Client Portal Invoices redesign (#2349). The invoice builder has always collected line items
// (description / qty / rate) but only the totals were saved, so an invoice could not be re-opened,
// edited or duplicated with its lines. Lines now live in their own table; invoice totals are
// computed from them by the API. Existing invoices get one line for the whole amount so every
// invoice has >= 1 line.
//
// Requires 1790757937262_add_invoice_payment_status.js (reads subtotal and project_name).

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_invoice_line_items (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        invoice_id UUID NOT NULL REFERENCES client_portal_invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
        rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
        amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_invoice_line_items_invoice_id
        ON client_portal_invoice_line_items(invoice_id, position);

    -- Backfill: one line per invoice that has none yet. Safe to re-run.
    INSERT INTO client_portal_invoice_line_items (invoice_id, description, quantity, rate, amount, position)
    SELECT i.id,
           COALESCE(NULLIF(BTRIM(i.project_name), ''), NULLIF(BTRIM(s.name), ''), 'Services'),
           1,
           COALESCE(NULLIF(i.subtotal, 0), i.amount),
           COALESCE(NULLIF(i.subtotal, 0), i.amount),
           0
    FROM client_portal_invoices i
    LEFT JOIN client_portal_requests r ON r.id = i.request_id
    LEFT JOIN client_portal_services s ON s.id = r.service_id
    WHERE NOT EXISTS (
        SELECT 1 FROM client_portal_invoice_line_items li WHERE li.invoice_id = i.id
    );

    COMMENT ON TABLE client_portal_invoice_line_items IS
      'Line items (description / qty / rate) of a client portal invoice. invoice.subtotal is the sum of amount over these rows.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Line-item detail is lost (invoice totals stay on client_portal_invoices).
  pgm.sql(`DROP TABLE IF EXISTS client_portal_invoice_line_items;`);
};
