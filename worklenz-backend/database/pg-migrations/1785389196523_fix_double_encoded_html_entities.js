'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Collapse double/triple HTML-entity encoding in names
-- sanitizePlainText() used to run sanitize-html's own escaping (& -> &amp;)
-- and then re-escape the result again, producing values like "&amp;amp;"
-- or worse for repeatedly-edited rows. That extra escaping pass has been
-- removed from the application code; this migration repairs rows that were
-- already saved with the doubled entities.
--
-- Only projects.name, tasks.name, and users.name go through
-- sanitizePlainText() on save, so those are the only columns affected.

-- Users (no unique constraint on name, simple in-place update)
DO $$
DECLARE
    rec RECORD;
    old_val TEXT;
    new_val TEXT;
BEGIN
    FOR rec IN
        SELECT id, name FROM users WHERE name ~ '&amp;(amp;|lt;|gt;)'
    LOOP
        old_val := rec.name;
        LOOP
            new_val := REPLACE(REPLACE(REPLACE(old_val, '&amp;amp;', '&amp;'), '&amp;lt;', '&lt;'), '&amp;gt;', '&gt;');
            EXIT WHEN new_val = old_val;
            old_val := new_val;
        END LOOP;
        IF new_val != rec.name THEN
            UPDATE users SET name = new_val WHERE id = rec.id;
        END IF;
    END LOOP;
END $$;

-- Tasks (no unique constraint on name, simple in-place update)
DO $$
DECLARE
    rec RECORD;
    old_val TEXT;
    new_val TEXT;
BEGIN
    FOR rec IN
        SELECT id, name FROM tasks WHERE name ~ '&amp;(amp;|lt;|gt;)'
    LOOP
        old_val := rec.name;
        LOOP
            new_val := REPLACE(REPLACE(REPLACE(old_val, '&amp;amp;', '&amp;'), '&amp;lt;', '&lt;'), '&amp;gt;', '&gt;');
            EXIT WHEN new_val = old_val;
            old_val := new_val;
        END LOOP;
        IF new_val != rec.name THEN
            UPDATE tasks SET name = new_val WHERE id = rec.id;
        END IF;
    END LOOP;
END $$;

-- Projects (unique constraint on (name, team_id) — collapsing entities can
-- collide with an existing sibling project, so fall back to a counter suffix)
DO $$
DECLARE
    rec RECORD;
    old_val TEXT;
    new_val TEXT;
    final_val TEXT;
    counter INTEGER;
BEGIN
    FOR rec IN
        SELECT id, name, team_id FROM projects WHERE name ~ '&amp;(amp;|lt;|gt;)'
        ORDER BY created_at ASC
    LOOP
        old_val := rec.name;
        LOOP
            new_val := REPLACE(REPLACE(REPLACE(old_val, '&amp;amp;', '&amp;'), '&amp;lt;', '&lt;'), '&amp;gt;', '&gt;');
            EXIT WHEN new_val = old_val;
            old_val := new_val;
        END LOOP;

        CONTINUE WHEN new_val = rec.name;

        final_val := new_val;
        counter := 1;
        WHILE EXISTS (
            SELECT 1 FROM projects
            WHERE name = final_val AND team_id = rec.team_id AND id != rec.id
        ) LOOP
            final_val := new_val || ' (' || counter || ')';
            counter := counter + 1;
        END LOOP;

        UPDATE projects SET name = final_val WHERE id = rec.id;

        IF final_val != new_val THEN
            RAISE NOTICE 'Project renamed: "%" -> "%" (duplicate resolved)', rec.name, final_val;
        END IF;
    END LOOP;
END $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Entity-collapsing is lossy with respect to the original double-encoded
  // value once duplicate suffixes are applied — no automatic rollback defined.
};
