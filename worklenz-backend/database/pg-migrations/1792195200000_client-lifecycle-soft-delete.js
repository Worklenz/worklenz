'use strict';
// Client Portal: deleting a client organization is a soft delete (`clients.deleted_at`, restorable for 30 days,
// then purged by the retention job). This migration makes that safe:
//
//   clients_name_team_id_uindex   unique only among LIVE clients, so a new client can reuse the name of a deleted one
//   clients_invite_slug_unique    same for the custom sign-in slug
//   clients.purged_at             set when the retention job removed a deleted client's data but kept its row
//   idx_clients_purge_candidates  the retention job looks up deleted clients by `deleted_at`
//   create_project / update_project  look a client up by name; they must never attach a project to a deleted client
//
// `clients.deleted_at` itself already exists (1753401612000_add_client_portal_soft_delete_columns.js).
// Idempotent. The `down` restores the old, non-partial indexes and fails if a live and a deleted client now share a
// name (rename or purge one first); that is the one thing this migration makes possible.

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clients_name_team_id_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS clients_name_team_id_uindex
      ON clients (name, team_id)
      WHERE deleted_at IS NULL;

    DROP INDEX IF EXISTS clients_invite_slug_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS clients_invite_slug_unique
      ON clients (LOWER(invite_slug))
      WHERE invite_slug IS NOT NULL AND deleted_at IS NULL;

    -- Set once the retention job has removed a deleted client's data but kept the row (it still has invoices).
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS purged_at TIMESTAMP WITH TIME ZONE;

    CREATE INDEX IF NOT EXISTS idx_clients_purge_candidates
      ON clients (deleted_at)
      WHERE deleted_at IS NOT NULL AND purged_at IS NULL;
  `);

  // The two project functions were redefined by many migrations, so patch the live definitions in place
  // instead of copying their bodies. A no-op where already patched or where the function is missing.
  pgm.sql(`
    DO $patch$
    DECLARE
      _def text;
      _old text := 'SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;';
      _new text := 'SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id AND deleted_at IS NULL INTO _client_id;';
    BEGIN
      IF to_regprocedure('create_project(json)') IS NOT NULL THEN
        _def := pg_get_functiondef(to_regprocedure('create_project(json)'));
        IF position(_old in _def) > 0 THEN
          EXECUTE replace(_def, _old, _new);
        END IF;
      END IF;

      IF to_regprocedure('update_project(json)') IS NOT NULL THEN
        _def := pg_get_functiondef(to_regprocedure('update_project(json)'));
        IF position(_old in _def) > 0 THEN
          EXECUTE replace(_def, _old, _new);
        END IF;
      END IF;
    END
    $patch$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DO $unpatch$
    DECLARE
      _def text;
      _old text := 'SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id AND deleted_at IS NULL INTO _client_id;';
      _new text := 'SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;';
    BEGIN
      IF to_regprocedure('create_project(json)') IS NOT NULL THEN
        _def := pg_get_functiondef(to_regprocedure('create_project(json)'));
        IF position(_old in _def) > 0 THEN
          EXECUTE replace(_def, _old, _new);
        END IF;
      END IF;

      IF to_regprocedure('update_project(json)') IS NOT NULL THEN
        _def := pg_get_functiondef(to_regprocedure('update_project(json)'));
        IF position(_old in _def) > 0 THEN
          EXECUTE replace(_def, _old, _new);
        END IF;
      END IF;
    END
    $unpatch$;

    DROP INDEX IF EXISTS idx_clients_purge_candidates;
    ALTER TABLE clients DROP COLUMN IF EXISTS purged_at;

    DROP INDEX IF EXISTS clients_invite_slug_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS clients_invite_slug_unique
      ON clients (LOWER(invite_slug))
      WHERE invite_slug IS NOT NULL;

    DROP INDEX IF EXISTS clients_name_team_id_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS clients_name_team_id_uindex
      ON clients (name, team_id);
  `);
};
