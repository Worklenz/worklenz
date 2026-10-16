'use strict';
// Audit Log spec: let the audit_events.team_id / actor_user_id ON DELETE SET NULL
// foreign-key actions through the append-only trigger.
//
// Postgres executes a SET NULL referential action as an UPDATE on the referencing table, which
// fires prevent_audit_events_mutation_trigger. The original trigger rejected every UPDATE, so
// deleting any team or user that appears in the audit log (e.g. Admin Center > Teams > delete)
// failed outright. The only UPDATE now permitted outside the retention purge is one that nulls
// team_id and/or actor_user_id while leaving every other column untouched - attribution is
// preserved by actor_name, so this never alters the evidentiary content of a row.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_audit_events_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF current_setting('worklenz.audit_purge_in_progress', true) = 'on' THEN
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END IF;

      -- organization_id is ON DELETE CASCADE. Permit only that referential delete; direct
      -- deletes still fall through to the append-only exception below.
      IF TG_OP = 'DELETE'
         AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id)
      THEN
        RETURN OLD;
      END IF;

      -- team_id and actor_user_id are ON DELETE SET NULL. Permit that referential update only
      -- when the referenced entity has actually been deleted; direct updates that attempt to
      -- erase attribution while the referenced row still exists fall through to the exception.
      IF TG_OP = 'UPDATE'
         AND (
           NEW.team_id IS NOT DISTINCT FROM OLD.team_id
           OR (NEW.team_id IS NULL AND NOT EXISTS (SELECT 1 FROM teams WHERE id = OLD.team_id))
         )
         AND (
           NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
           OR (NEW.actor_user_id IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.actor_user_id))
         )
         AND (NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id)
         AND (to_jsonb(NEW) - 'team_id' - 'actor_user_id') = (to_jsonb(OLD) - 'team_id' - 'actor_user_id')
      THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'audit_events is append-only: % is not permitted (only the retention purge job may remove entries)', TG_OP;
    END;
    $$;
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_audit_events_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF current_setting('worklenz.audit_purge_in_progress', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'audit_events is append-only: % is not permitted (only the retention purge job may remove entries)', TG_OP;
      END IF;

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$;
  `);
};
