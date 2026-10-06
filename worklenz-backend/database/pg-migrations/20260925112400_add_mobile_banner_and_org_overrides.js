'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE users
        ADD COLUMN IF NOT EXISTS mobile_app_banner_dismissed BOOLEAN DEFAULT FALSE;

    ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS business_plan_override BOOLEAN DEFAULT FALSE NOT NULL;

    COMMENT ON COLUMN organizations.business_plan_override IS
      'Manual override to grant business plan feature access (client portal, Slack, finance, etc.) regardless of subscription status. Set manually by admins.';

    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'organizations'
              AND column_name = 'team_member_limit_override'
              AND data_type = 'integer'
        ) THEN
            ALTER TABLE organizations
              ALTER COLUMN team_member_limit_override TYPE BOOLEAN USING (team_member_limit_override IS NOT NULL AND team_member_limit_override > 0),
              ALTER COLUMN team_member_limit_override SET DEFAULT FALSE,
              ALTER COLUMN team_member_limit_override SET NOT NULL;
        ELSE
            ALTER TABLE organizations
              ADD COLUMN IF NOT EXISTS team_member_limit_override BOOLEAN DEFAULT FALSE NOT NULL;
        END IF;
    END $$;

    COMMENT ON COLUMN organizations.team_member_limit_override IS
      'Manual override to bypass all team member limits. When enabled, organization can add unlimited team members regardless of subscription plan.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS mobile_app_banner_dismissed;
    ALTER TABLE organizations DROP COLUMN IF EXISTS business_plan_override;
    ALTER TABLE organizations DROP COLUMN IF EXISTS team_member_limit_override;
  `);
};
