/**
 * Migration: Add Business Plan override columns to organizations table
 * Date: 2026-03-16
 * Description: Add columns to override plan name and team member limit for AppSumo users who redeem 5 codes
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  // Add business plan override column (boolean to indicate Business Plan is activated)
  pgm.addColumn('organizations', 'business_plan_override', {
    type: 'BOOLEAN',
    default: false,
    notNull: true
  });

  // Add team member limit override column (integer to store the new limit)
  pgm.addColumn('organizations', 'team_member_limit_override', {
    type: 'INTEGER',
    default: null
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.dropColumn('organizations', 'business_plan_override');
  pgm.dropColumn('organizations', 'team_member_limit_override');
};
