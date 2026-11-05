'use strict';

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_contacts DROP CONSTRAINT IF EXISTS client_contacts_language_check;
    ALTER TABLE client_contacts ADD CONSTRAINT client_contacts_language_check
      CHECK (language IN ('en', 'es', 'pt', 'al', 'de', 'zh', 'pl', 'fr', 'it'));
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_contacts DROP CONSTRAINT IF EXISTS client_contacts_language_check;
    ALTER TABLE client_contacts ADD CONSTRAINT client_contacts_language_check
      CHECK (language IN ('en', 'es', 'pt', 'al', 'de', 'zh', 'pl', 'fr'));
  `);
};
