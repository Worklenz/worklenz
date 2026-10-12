'use strict';
// Reporting & Analytics > Custom Dashboards: the gadget instances placed on a dashboard.
//
//   dashboard_gadgets   one row per gadget on a dashboard: its type, its cell on the 12-column
//                       grid, and its own configuration (project, sprint, date range, ...).
//                       The same gadget type can appear several times on one dashboard, each with
//                       its own config. Saving a layout replaces the dashboard's whole set in one
//                       transaction.
//
// `type` is deliberately not CHECK-bound: the gadget catalogue is expected to grow and a new
// gadget should not need a migration. The API validates type and config against the gadget
// registry. Geometry is bounded here as well, mirroring the API validator, so a bad write can
// never leave a row the grid cannot render.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS dashboard_gadgets (
      id           UUID                     NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      dashboard_id UUID                     NOT NULL REFERENCES dashboards (id) ON DELETE CASCADE,
      type         TEXT                     NOT NULL,
      x            INTEGER                  NOT NULL,
      y            INTEGER                  NOT NULL,
      w            INTEGER                  NOT NULL,
      h            INTEGER                  NOT NULL,
      config       JSONB                    NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT dashboard_gadgets_type_length_check
        CHECK (CHAR_LENGTH(type) BETWEEN 1 AND 64),
      CONSTRAINT dashboard_gadgets_geometry_check
        CHECK (x >= 0 AND y BETWEEN 0 AND 10000 AND w BETWEEN 1 AND 12 AND h BETWEEN 1 AND 60 AND x + w <= 12),
      CONSTRAINT dashboard_gadgets_config_is_object CHECK (jsonb_typeof(config) = 'object')
    );

    -- Loading a dashboard reads all of its gadgets; also serves the ON DELETE CASCADE.
    CREATE INDEX IF NOT EXISTS idx_dashboard_gadgets_dashboard_id
      ON dashboard_gadgets (dashboard_id);

    COMMENT ON TABLE dashboard_gadgets IS
      'Gadget instances on a dashboard: type, 12-column grid cell (x, y, w, h) and per-gadget config. Display and filter preferences only; never grants access to data.';
    COMMENT ON COLUMN dashboard_gadgets.config IS
      'Per-gadget settings (project, sprint, date range, text, embed URL, ...). Validated per gadget type by the API.';
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_dashboard_gadgets_dashboard_id;
    DROP TABLE IF EXISTS dashboard_gadgets;
  `);
};
