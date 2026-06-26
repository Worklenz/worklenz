/**
 * Utility functions for validating and constraining column widths
 */

interface BaseColumn {
  id: string;
  minWidth?: string;
  maxWidth?: string;
  width?: string;
}

/**
 * Validates a column width against min/max constraints and special rules
 * @param columnId - The ID of the column being validated
 * @param width - The width value to validate (can be string with 'px' or number)
 * @param baseColumn - Optional base column configuration with minWidth/maxWidth
 * @returns Validated width as a string with 'px' suffix
 */
export function validateColumnWidth(
  columnId: string,
  width: string | number,
  baseColumn?: BaseColumn | null
): string {
  // Convert width to number for comparison
  const widthString = typeof width === 'string' ? width : `${width}px`;
  const currentWidth = parseInt(widthString.replace('px', ''), 10);

  // Handle NaN or invalid values
  if (isNaN(currentWidth)) {
    return baseColumn?.width || '150px';
  }

  let validatedWidth = currentWidth;

  // Apply base column constraints if provided
  if (baseColumn) {
    // Check minWidth constraint
    if (baseColumn.minWidth) {
      const minWidth = parseInt(baseColumn.minWidth.replace('px', ''), 10);
      if (!isNaN(minWidth) && validatedWidth < minWidth) {
        validatedWidth = minWidth;
      }
    }

    // Check maxWidth constraint
    if (baseColumn.maxWidth) {
      const maxWidth = parseInt(baseColumn.maxWidth.replace('px', ''), 10);
      if (!isNaN(maxWidth) && validatedWidth > maxWidth) {
        validatedWidth = maxWidth;
      }
    }
  }

  // Special rules for specific columns
  // Force title column to max width constraint (400px)
  if (columnId === 'title' && validatedWidth > 400) {
    validatedWidth = 400;
  }

  // Force description column to min width constraint (200px)
  if (columnId === 'description' && validatedWidth < 200) {
    validatedWidth = 200;
  }

  return `${validatedWidth}px`;
}

/**
 * Validates multiple column widths in a record
 * @param widths - Record of columnId to width values
 * @param baseColumns - Array of base column configurations to match against
 * @returns Record of validated widths
 */
export function validateColumnWidths(
  widths: Record<string, string | number>,
  baseColumns: BaseColumn[] = []
): Record<string, string> {
  const validated: Record<string, string> = {};

  Object.entries(widths).forEach(([columnId, width]) => {
    const baseColumn = baseColumns.find(col => col.id === columnId);
    validated[columnId] = validateColumnWidth(columnId, width, baseColumn);
  });

  return validated;
}
