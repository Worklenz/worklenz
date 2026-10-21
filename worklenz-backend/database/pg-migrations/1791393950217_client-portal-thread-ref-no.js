'use strict';
// Client Portal v2 discussions: a short, human-friendly reference (DS-000123) on every thread, so
// staff can copy it and search for the thread by it. ref_seq is the number; ref_no is derived from it
// so the two can never disagree. Existing threads are numbered in the order they were created.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE SEQUENCE IF NOT EXISTS client_portal_threads_ref_seq;

    ALTER TABLE client_portal_threads ADD COLUMN IF NOT EXISTS ref_seq BIGINT;

    UPDATE client_portal_threads t
       SET ref_seq = n.rn
      FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn FROM client_portal_threads) n
     WHERE t.id = n.id AND t.ref_seq IS NULL;

    SELECT setval('client_portal_threads_ref_seq', COALESCE((SELECT MAX(ref_seq) FROM client_portal_threads), 0) + 1, false);

    ALTER TABLE client_portal_threads
        ALTER COLUMN ref_seq SET DEFAULT nextval('client_portal_threads_ref_seq'),
        ALTER COLUMN ref_seq SET NOT NULL;
    ALTER SEQUENCE client_portal_threads_ref_seq OWNED BY client_portal_threads.ref_seq;

    ALTER TABLE client_portal_threads
        ADD COLUMN IF NOT EXISTS ref_no TEXT GENERATED ALWAYS AS ('DS-' || lpad(ref_seq::text, 6, '0')) STORED;

    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_threads_ref_seq_uindex ON client_portal_threads (ref_seq);
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS client_portal_threads_ref_seq_uindex;
    ALTER TABLE client_portal_threads DROP COLUMN IF EXISTS ref_no;
    ALTER TABLE client_portal_threads DROP COLUMN IF EXISTS ref_seq;
    DROP SEQUENCE IF EXISTS client_portal_threads_ref_seq;
  `);
};
