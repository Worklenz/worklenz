'use strict';
// Client Portal Quotes (#2470). Pre-sale estimates that mirror invoices structurally: line items,
// tax / discount, an optional linked request, but with a Valid Until date instead of a due date
// and no payment tracking. Status is staff-managed:
//   draft / sent / accepted / declined / expired
// Quote totals are computed from the line items by the API.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_quotes (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        quote_no TEXT NOT NULL,
        client_id UUID NOT NULL REFERENCES clients(id),
        organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        -- A quote outlives its request: deleting the request just clears the reference.
        request_id UUID REFERENCES client_portal_requests(id) ON DELETE SET NULL,
        created_by_user_id UUID REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'draft',
        currency TEXT NOT NULL DEFAULT 'USD',
        project_name TEXT,
        notes TEXT,
        valid_until DATE,
        subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
        tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_type TEXT NOT NULL DEFAULT 'percentage',
        discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_quotes_status_check
            CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
        CONSTRAINT client_portal_quotes_discount_type_check
            CHECK (discount_type IN ('percentage', 'fixed')),
        CONSTRAINT client_portal_quotes_amount_check CHECK (amount >= 0),
        CONSTRAINT client_portal_quotes_org_quote_no_key UNIQUE (organization_team_id, quote_no)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_quotes_org_status
        ON client_portal_quotes(organization_team_id, status);

    CREATE INDEX IF NOT EXISTS idx_client_portal_quotes_org_valid_until
        ON client_portal_quotes(organization_team_id, valid_until);

    CREATE INDEX IF NOT EXISTS idx_client_portal_quotes_client_id
        ON client_portal_quotes(client_id);

    CREATE INDEX IF NOT EXISTS idx_client_portal_quotes_request_id
        ON client_portal_quotes(request_id);

    CREATE TABLE IF NOT EXISTS client_portal_quote_line_items (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        quote_id UUID NOT NULL REFERENCES client_portal_quotes(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
        rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
        amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_quote_line_items_quote_id
        ON client_portal_quote_line_items(quote_id, position);

    COMMENT ON TABLE client_portal_quotes IS
      'Client portal quotes (pre-sale estimates). status is set manually by staff; there is no payment tracking.';
    COMMENT ON COLUMN client_portal_quotes.valid_until IS
      'Last day the quote can be accepted. Optional; shown in red once status = expired.';
    COMMENT ON TABLE client_portal_quote_line_items IS
      'Line items (description / qty / rate) of a client portal quote. quote.subtotal is the sum of amount over these rows.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Quotes and their line items are dropped; nothing else references them.
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_quote_line_items;
    DROP TABLE IF EXISTS client_portal_quotes;
  `);
};
