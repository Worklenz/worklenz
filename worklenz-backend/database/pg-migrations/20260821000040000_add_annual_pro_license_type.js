'use strict';
// Converted from database/migrations/release-v2.6/20260626000001-add-annual-pro-license-type.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    INSERT INTO sys_license_types (id, key, name)
    SELECT uuid_generate_v4(), 'ANNUAL_PRO', 'Annual Pro Plan'
    WHERE NOT EXISTS (SELECT 1 FROM sys_license_types WHERE key = 'ANNUAL_PRO');

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'licensing_custom_subs') AND
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'licensing_custom_plan_pricing') THEN
        UPDATE organizations
        SET license_type_id = (SELECT id FROM sys_license_types WHERE key = 'ANNUAL_PRO')
        WHERE user_id IN (
            SELECT lcs.user_id
            FROM licensing_custom_subs lcs
            JOIN licensing_custom_plan_pricing lpp ON lpp.id = lcs.plan_tier_id
            WHERE lcs.status IN ('active', 'pending')
              AND lpp.tier_name = 'pro'
        );
      END IF;
    END $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
