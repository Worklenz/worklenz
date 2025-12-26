/**
 * Constants for column resize functionality
 */

// Column width constraints
export const COLUMN_WIDTH_CONSTRAINTS = {
  MIN_WIDTH: 50,
  MAX_WIDTH: 800,
  TITLE_MAX_WIDTH: 400,
  DESCRIPTION_MIN_WIDTH: 200,
} as const;

// Default column widths
export const DEFAULT_COLUMN_WIDTHS = {
  TITLE: 470,
  DESCRIPTION: 260,
  DEFAULT: 150,
} as const;

// Storage key prefix for column widths
export const COLUMN_WIDTH_STORAGE_PREFIX = 'worklenz.taskList.columnWidths';

