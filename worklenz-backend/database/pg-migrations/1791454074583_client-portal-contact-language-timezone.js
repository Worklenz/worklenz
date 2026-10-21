'use strict';
// Client Portal v2, client-facing app (#2520): Settings > Language and Region. A client user picks a
// language and a time zone once and they follow them across devices.
//
//   language  one of the portal's shipped locales (the client app's src/locales folders).
//   timezone  the IANA name of a row in `timezones` (for example Asia/Colombo). NULL means "use the
//             browser's time zone", which is what everyone had before this existed.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_contacts
        ADD COLUMN IF NOT EXISTS language VARCHAR(8) NOT NULL DEFAULT 'en',
        ADD COLUMN IF NOT EXISTS timezone TEXT;

    ALTER TABLE client_contacts DROP CONSTRAINT IF EXISTS client_contacts_language_check;
    ALTER TABLE client_contacts
        ADD CONSTRAINT client_contacts_language_check
        CHECK (language IN ('en', 'es', 'pt', 'al', 'de', 'zh', 'pl', 'fr'));

    COMMENT ON COLUMN client_contacts.language IS
      'Display language of the client portal for this person (a shipped locale code).';
    COMMENT ON COLUMN client_contacts.timezone IS
      'IANA time zone name from the timezones table; NULL = use the browser''s time zone.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_contacts DROP CONSTRAINT IF EXISTS client_contacts_language_check;
    ALTER TABLE client_contacts
        DROP COLUMN IF EXISTS timezone,
        DROP COLUMN IF EXISTS language;
  `);
};
