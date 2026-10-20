'use strict';
// Per-user Home page preferences (#2372): widget layout, task tab order/visibility, and the
// last-used selections (period, assigned group, active tab, sort). One row per user, stored as a
// versioned JSON document. The API validates the document before it is written
// (src/shared/home-preferences.ts); the CHECK below is only a last line of defence.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_home_preferences (
        user_id     UUID        NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        preferences JSONB       NOT NULL DEFAULT '{}'::JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT user_home_preferences_is_object_check
            CHECK (jsonb_typeof(preferences) = 'object')
    );
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS user_home_preferences;`);
};
