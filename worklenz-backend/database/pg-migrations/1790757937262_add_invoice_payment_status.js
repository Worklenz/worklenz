'use strict';
// Client Portal Invoices redesign (#2349). An invoice now carries two independent fields:
//   status          - where the invoice is in its lifecycle (draft / sent / pending / overdue;
//                     cancelled is kept)
//   payment_status  - how much has been paid (unpaid / partially_paid / paid)
// plus paid_amount (always within [0, amount]) and project_name. Before this, "paid" was a value
// of status, so an invoice could not be both "sent" and "partially paid". Existing paid invoices
// are backfilled below.
//
// Also adds the tax / discount / subtotal columns the invoice controller already writes to; they
// had no migration in this repo, so they are created here with IF NOT EXISTS (a no-op where they
// already exist).
//
// Must run before 1790757997262_create_invoice_line_items.js: it reads subtotal and project_name.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- 1. New columns -----------------------------------------------------------------------------
    ALTER TABLE client_portal_invoices
        ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
        ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS project_name TEXT;

    -- Finance columns already written by ClientPortalInvoicesController.createInvoice
    ALTER TABLE client_portal_invoices
        ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'percentage',
        ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

    -- 2. Backfill: a "paid" status becomes paid payment status + a still-sent document -----------
    UPDATE client_portal_invoices
    SET payment_status = 'paid',
        paid_amount    = amount,
        paid_at        = COALESCE(paid_at, updated_at, created_at),
        sent_at        = COALESCE(sent_at, created_at),
        status         = 'sent'
    WHERE status = 'paid';

    -- 3. Constraints -------------------------------------------------------------------------------
    ALTER TABLE client_portal_invoices
        DROP CONSTRAINT IF EXISTS client_portal_invoices_payment_status_check;
    ALTER TABLE client_portal_invoices
        ADD CONSTRAINT client_portal_invoices_payment_status_check
        CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid'));

    -- Paid Amount is always within [0, invoice amount]; the API clamps, this is the safety net.
    ALTER TABLE client_portal_invoices
        DROP CONSTRAINT IF EXISTS client_portal_invoices_paid_amount_check;
    ALTER TABLE client_portal_invoices
        ADD CONSTRAINT client_portal_invoices_paid_amount_check
        CHECK (paid_amount >= 0 AND paid_amount <= amount);

    -- Adds 'pending'. 'paid' stays allowed (legacy) so a backend instance still running the old
    -- code during a rolling deploy cannot hit a constraint error; the new code never writes it.
    ALTER TABLE client_portal_invoices
        DROP CONSTRAINT IF EXISTS client_portal_invoices_status_check;
    ALTER TABLE client_portal_invoices
        ADD CONSTRAINT client_portal_invoices_status_check
        CHECK (status IN ('draft', 'sent', 'pending', 'overdue', 'cancelled', 'paid'));

    -- 4. Indexes for the list filters / sort + stat totals ------------------------------------------
    CREATE INDEX IF NOT EXISTS idx_client_portal_invoices_payment_status
        ON client_portal_invoices(organization_team_id, payment_status);

    CREATE INDEX IF NOT EXISTS idx_client_portal_invoices_due_date
        ON client_portal_invoices(organization_team_id, due_date);

    COMMENT ON COLUMN client_portal_invoices.payment_status IS
      'unpaid | partially_paid | paid. Independent of status (the document lifecycle).';
    COMMENT ON COLUMN client_portal_invoices.paid_amount IS
      'Amount received so far, always within [0, amount]. Equals amount when payment_status = paid, 0 when unpaid.';
    COMMENT ON COLUMN client_portal_invoices.project_name IS
      'Free-text project / description shown in the invoice list. Not tied to a project record.';
  `);

  // Known follow-up (not changed here): the client_portal_stats_view view and the
  // get_client_portal_stats() function from release-v2.2.0 still count paid / unpaid invoices
  // from status. Nothing in the application reads them; update them if that changes.
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Restores "paid" as a status for fully paid invoices, then drops the new pieces. Partial
  // payments (paid_amount) and project names are lost. The finance columns are left in place
  // because the application wrote to them before this migration existed.
  pgm.sql(`
    UPDATE client_portal_invoices SET status = 'paid' WHERE payment_status = 'paid';
    UPDATE client_portal_invoices SET status = 'sent' WHERE status = 'pending';

    ALTER TABLE client_portal_invoices DROP CONSTRAINT IF EXISTS client_portal_invoices_status_check;
    ALTER TABLE client_portal_invoices
        ADD CONSTRAINT client_portal_invoices_status_check
        CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'));

    DROP INDEX IF EXISTS idx_client_portal_invoices_payment_status;
    DROP INDEX IF EXISTS idx_client_portal_invoices_due_date;

    ALTER TABLE client_portal_invoices DROP CONSTRAINT IF EXISTS client_portal_invoices_paid_amount_check;
    ALTER TABLE client_portal_invoices DROP CONSTRAINT IF EXISTS client_portal_invoices_payment_status_check;

    ALTER TABLE client_portal_invoices
        DROP COLUMN IF EXISTS payment_status,
        DROP COLUMN IF EXISTS paid_amount,
        DROP COLUMN IF EXISTS project_name;
  `);
};
