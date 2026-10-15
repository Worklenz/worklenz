'use strict';
// Client Portal v2, client-facing app (#2520): a client user's customised dashboard.
//
//   client_portal_dashboard_layouts   one row per client user (contact) holding their widget
//                                      arrangement and per-widget settings (which projects the
//                                      "Your projects" widget shows, which card fields, ...).
//                                      No row means the user never customised: the app renders its
//                                      default layout. The layout is a display preference only; what
//                                      data a widget can show is still decided per request by the
//                                      project scope, never by this table.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS client_portal_dashboard_layouts (
        id         UUID                     NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        contact_id UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        layout     JSONB                    NOT NULL,
        version    INTEGER                  NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_dashboard_layouts_contact_key UNIQUE (contact_id)
    );

    COMMENT ON TABLE client_portal_dashboard_layouts IS
      'Per client user: their customised dashboard (widget positions, sizes, visibility and settings). No row = default layout. Display preference only; never grants access.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_dashboard_layouts;
  `);
};
