/**
 * Constants for column resize functionality
 */

// Column width constraints
export const COLUMN_WIDTH_CONSTRAINTS = {
  MIN_WIDTH: 50,
  MAX_WIDTH: 800,
  TITLE_MAX_WIDTH: 400,
  DESCRIPTION_MIN_WIDTH: 200,
  LABELS_MIN_WIDTH: 270,
} as const;

// Default column widths
// Note: TITLE must not exceed TITLE_MAX_WIDTH (400) from COLUMN_WIDTH_CONSTRAINTS
export const DEFAULT_COLUMN_WIDTHS = {
  TITLE: 350, // Matches columns.ts width and is within TITLE_MAX_WIDTH constraint
  DESCRIPTION: 260,
  LABELS: 270,
  DEFAULT: 250,
} as const;

// Storage key prefix for column widths
export const COLUMN_WIDTH_STORAGE_PREFIX = 'worklenz.taskList.columnWidths';
