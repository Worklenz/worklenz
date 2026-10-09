'use strict';
// Audit Log spec task 1.3: per-organization ("workspace") retention setting,
// plus the one and only sanctioned way audit_events rows may ever be removed.
//
// Default of 12 months is a firm requirement from the spec (must meet the PCI DSS 12-month
// minimum out of the box, not require the customer to configure it). The exact configurable
// min/max range is still open (spec task 0.4 is a [NEED]), so the DB-level CHECK below is a
// generous sanity bound only (1-120 months) - it is not the product policy. The tighter range
// actually exposed in the UI (the mockup offers 3/6/12/24) belongs in an application-layer
// validator, which can change without a migration once 0.4 is confirmed.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS audit_log_retention_months INTEGER DEFAULT 12 NOT NULL;

    ALTER TABLE organizations
      ADD CONSTRAINT organizations_audit_log_retention_months_range
        CHECK (audit_log_retention_months BETWEEN 1 AND 120);

    COMMENT ON COLUMN organizations.audit_log_retention_months IS
      'How long Audit Log entries (audit_events) are kept before the retention purge job ages them out. Defaults to 12 months to meet the PCI DSS minimum out of the box. Configurable by the organization owner; DB-level bound (1-120) is a sanity guard, not the product-exposed range.';

    -- The sole sanctioned path for removing audit_events rows. SECURITY DEFINER so it runs with
    -- this migration's (schema-owner) privileges rather than the caller's - worklenz_client has
    -- no direct DELETE on audit_events (see create-audit-events-table migration) and is only
    -- granted EXECUTE on this function below. It also flips the transaction-local flag that
    -- prevent_audit_events_mutation_trigger checks, so the append-only trigger lets this
    -- specific, age-based delete through and nothing else.
    CREATE OR REPLACE FUNCTION purge_expired_audit_events(p_organization_id UUID DEFAULT NULL)
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      _deleted_count INTEGER;
    BEGIN
      PERFORM set_config('worklenz.audit_purge_in_progress', 'on', true);

      DELETE FROM audit_events ae
      USING organizations o
      WHERE o.id = ae.organization_id
        AND (p_organization_id IS NULL OR ae.organization_id = p_organization_id)
        AND ae.created_at < NOW() - (o.audit_log_retention_months || ' months')::INTERVAL;

      GET DIAGNOSTICS _deleted_count = ROW_COUNT;

      PERFORM set_config('worklenz.audit_purge_in_progress', 'off', true);

      RETURN _deleted_count;
    END;
    $$;

    COMMENT ON FUNCTION purge_expired_audit_events(UUID) IS
      'Deletes audit_events rows older than their organization''s audit_log_retention_months. Pass an organization_id to scope to one org, or NULL (default) to sweep all orgs - intended to be invoked by a scheduled retention job, never from a user-facing endpoint.';

    GRANT EXECUTE ON FUNCTION purge_expired_audit_events(UUID) TO worklenz_client;
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP FUNCTION IF EXISTS purge_expired_audit_events(UUID);

    ALTER TABLE organizations
      DROP CONSTRAINT IF EXISTS organizations_audit_log_retention_months_range;

    ALTER TABLE organizations
      DROP COLUMN IF EXISTS audit_log_retention_months;
  `);
};
