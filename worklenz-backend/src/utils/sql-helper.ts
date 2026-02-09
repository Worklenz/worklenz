/**
 * SQL Helper Utility
 *
 * Provides secure SQL query building utilities to prevent SQL injection vulnerabilities.
 * All functions return parameterized query components that should be used with prepared statements.
 */

export interface SqlClauseResult {
  clause: string;
  params: any[];
}

export class SqlHelper {
  /**
   * Builds a parameterized IN clause for SQL queries.
   *
   * @param values - Array of values to include in the IN clause
   * @param startIndex - Starting parameter index (e.g., if you already have $1, $2, pass 3)
   * @returns Object with clause string and params array
   * @throws Error if values array is empty (forces callers to handle empty arrays explicitly)
   *
   * @example
   * const result = SqlHelper.buildInClause(['id1', 'id2', 'id3'], 1);
   * // result.clause: "IN ($1, $2, $3)"
   * // result.params: ['id1', 'id2', 'id3']
   * const query = `SELECT * FROM users WHERE id ${result.clause}`;
   * await db.query(query, result.params);
   */
  static buildInClause(values: any[], startIndex: number): SqlClauseResult {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('buildInClause requires a non-empty array. Use buildOptionalInClause for optional filters.');
    }

    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(', ');
    return {
      clause: `IN (${placeholders})`,
      params: values
    };
  }

  /**
   * Builds an optional parameterized IN clause for SQL queries.
   * Returns empty clause if values array is empty, making it safe for optional filters.
   *
   * @param values - Array of values to include in the IN clause (can be empty)
   * @param columnName - Name of the column for the IN clause
   * @param startIndex - Starting parameter index
   * @returns Object with clause string and params array (empty if values is empty)
   *
   * @example
   * const teamIds = []; // Empty array
   * const result = SqlHelper.buildOptionalInClause(teamIds, 'team_id', 1);
   * // result.clause: ""
   * // result.params: []
   * const query = `SELECT * FROM projects WHERE 1=1 ${result.clause}`;
   * await db.query(query, result.params);
   *
   * @example
   * const teamIds = ['team1', 'team2'];
   * const result = SqlHelper.buildOptionalInClause(teamIds, 'team_id', 1);
   * // result.clause: "AND team_id IN ($1, $2)"
   * // result.params: ['team1', 'team2']
   */
  static buildOptionalInClause(values: any[], columnName: string, startIndex: number): SqlClauseResult {
    if (!Array.isArray(values) || values.length === 0) {
      return {
        clause: '',
        params: []
      };
    }

    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(', ');
    return {
      clause: `AND ${columnName} IN (${placeholders})`,
      params: values
    };
  }

  /**
   * Validates a sort field against an allowlist to prevent SQL injection in ORDER BY clauses.
   *
   * @param field - The field to validate
   * @param allowedFields - Array of allowed field names
   * @param defaultField - Default field to return if validation fails
   * @returns The validated field or the default field
   *
   * @example
   * const sortField = SqlHelper.validateSortField(
   *   req.query.field,
   *   ['name', 'created_at', 'updated_at', 'key'],
   *   'name'
   * );
   * const query = `SELECT * FROM projects ORDER BY ${sortField}`;
   */
  static validateSortField(field: string, allowedFields: string[], defaultField: string): string {
    // Handle null, undefined, or non-string values
    if (!field || typeof field !== 'string') {
      return defaultField;
    }

    // Normalize the field (trim and lowercase for comparison)
    const normalizedField = field.trim().toLowerCase();

    // Check if the normalized field is in the allowlist
    const matchedField = allowedFields.find(allowed => allowed.toLowerCase() === normalizedField);

    return matchedField || defaultField;
  }

  /**
   * Validates a sort order to ensure it's either 'asc' or 'desc'.
   *
   * @param order - The order to validate
   * @returns Either 'asc' or 'desc' (defaults to 'asc' if invalid)
   *
   * @example
   * const sortOrder = SqlHelper.validateSortOrder(req.query.order);
   * const query = `SELECT * FROM projects ORDER BY name ${sortOrder}`;
   */
  static validateSortOrder(order: string): 'asc' | 'desc' {
    if (!order || typeof order !== 'string') {
      return 'asc';
    }

    const normalized = order.trim().toLowerCase();
    return normalized === 'desc' ? 'desc' : 'asc';
  }

  /**
   * Validates and builds a complete ORDER BY clause with both field and order validation.
   *
   * @param field - The field to sort by
   * @param order - The sort order ('asc' or 'desc')
   * @param allowedFields - Array of allowed field names
   * @param defaultField - Default field if validation fails
   * @returns Complete ORDER BY clause (without the "ORDER BY" keywords)
   *
   * @example
   * const orderByClause = SqlHelper.buildOrderByClause(
   *   req.query.field,
   *   req.query.order,
   *   ['name', 'created_at', 'updated_at'],
   *   'name'
   * );
   * const query = `SELECT * FROM projects ORDER BY ${orderByClause}`;
   */
  static buildOrderByClause(
    field: string,
    order: string,
    allowedFields: string[],
    defaultField: string
  ): string {
    const validatedField = this.validateSortField(field, allowedFields, defaultField);
    const validatedOrder = this.validateSortOrder(order);
    return `${validatedField} ${validatedOrder}`;
  }
}
