/**
 * Type definitions for column configuration
 */

export interface ColumnConfig {
  id: string;
  label: string;
  width: string;
  key?: string;
  isSticky?: boolean;
  minWidth?: string;
  maxWidth?: string;
  isCustom?: boolean;
  [key: string]: unknown;
}

export interface ColumnWidthConstraints {
  minWidth?: number;
  maxWidth?: number;
}
