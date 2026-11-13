import db from '../config/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CategoryOrderValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that the incoming array contains exactly 3 elements,
 * each a valid UUID, matching the 3 known category IDs (no duplicates, no unknown values).
 */
export async function validateCategoryOrder(order: unknown): Promise<CategoryOrderValidationResult> {
  if (!Array.isArray(order)) {
    return { valid: false, error: 'category_order must be an array' };
  }
  if (order.length !== 3) {
    return { valid: false, error: 'category_order must contain exactly 3 elements' };
  }
  for (const id of order) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      return { valid: false, error: `Invalid UUID: ${id}` };
    }
  }
  // Check for duplicates
  if (new Set(order).size !== 3) {
    return { valid: false, error: 'category_order must not contain duplicate IDs' };
  }
  // Verify all 3 IDs exist in sys_task_status_categories
  const result = await db.query(
    'SELECT id FROM sys_task_status_categories WHERE id = ANY($1::uuid[])',
    [order]
  );
  if (result.rows.length !== 3) {
    return { valid: false, error: 'category_order contains unknown category IDs' };
  }
  return { valid: true };
}
