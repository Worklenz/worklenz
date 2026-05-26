/**
 * Licensing plan limits shared across the frontend.
 * These values mirror the defaults stored in the `licensing_settings` table.
 * Update here when the DB default changes.
 */

export const LICENSING_SETTINGS = {
  /** Maximum number of custom fields (columns) allowed per project on non-Business plans. */
  CUSTOM_FIELDS_LIMIT: 10,
} as const;
