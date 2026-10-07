/**
 * Migration: Add Business Plan override columns to organizations table
 * Date: 2026-03-16
 * Description: Add columns to override plan name and team member limit for AppSumo users who redeem 5 codes
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.addColumns('organizations', {
    business_plan_override: {
      type: 'BOOLEAN',
      default: false,
      notNull: true,
    },
    team_member_limit_override: {
      type: 'INTEGER',
      default: null,
    },
  }, { ifNotExists: true });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.dropColumns('organizations', ['business_plan_override', 'team_member_limit_override'], { ifExists: true });
};
