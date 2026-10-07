'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE organization_holidays
      ADD COLUMN IF NOT EXISTS is_auto_synced BOOLEAN DEFAULT FALSE NOT NULL;

    COMMENT ON COLUMN organization_holidays.is_auto_synced IS
      'True when the row was copied from country_holidays (import/sync). Manual org holidays stay false so shared names like Christmas Day are not treated as leftovers.';

    -- Backfill: rows written by the old Sri Lanka auto-sync and the import endpoint
    -- were copies of country_holidays with the 'Public Holiday' type. Flag them now,
    -- while every such row is known to be a copy, so runtime cleanup only needs
    -- is_auto_synced and never has to guess by name/date.
    UPDATE organization_holidays oh
    SET is_auto_synced = TRUE
    WHERE oh.is_auto_synced = FALSE
      AND EXISTS (
        SELECT 1
        FROM holiday_types ht
        WHERE ht.id = oh.holiday_type_id
          AND ht.name = 'Public Holiday'
      )
      AND EXISTS (
        SELECT 1
        FROM country_holidays ch
        WHERE ch.name = oh.name
          AND ch.date = oh.date
      );

    -- Remove Sri Lankan auto-sync leftovers (e.g. Poya days) for organizations that
    -- already moved to another country before this fix. Their country change has
    -- already happened, so the runtime cleanup in updateHolidaySettings never runs
    -- for them. Rows that are also official holidays of the current country are kept.
    DELETE FROM organization_holidays oh
    USING organization_holiday_settings ohs
    WHERE ohs.organization_id = oh.organization_id
      AND oh.is_auto_synced = TRUE
      AND ohs.country_code IS NOT NULL
      AND ohs.country_code <> 'LK'
      AND EXISTS (
        SELECT 1
        FROM country_holidays ch
        WHERE ch.country_code = 'LK'
          AND ch.name = oh.name
          AND ch.date = oh.date
      )
      AND NOT EXISTS (
        SELECT 1
        FROM country_holidays ch
        WHERE ch.country_code = ohs.country_code
          AND ch.name = oh.name
          AND ch.date = oh.date
      );
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Deleted leftover rows are copies of country_holidays and are not restored.
  pgm.sql(`
    ALTER TABLE organization_holidays
      DROP COLUMN IF EXISTS is_auto_synced;
  `);
};
