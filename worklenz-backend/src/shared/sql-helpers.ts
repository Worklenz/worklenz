/**
 * This module provides secure utilities for building SQL queries with proper
 * parameterization for secure query building.
 * 
 * These helpers replace unsafe patterns like:
 * - Direct string interpolation: `SELECT * FROM users WHERE id = '${userId}'`
 * - flatString() for IN clauses: `WHERE id IN (${flatString(ids)})`
 * - String concatenation in queries
 */

/**
 * Interface for parameterized query result
 */
export interface ParameterizedQuery {
  query: string;
  params: any[];
}

/**
 * SQL Helper class with secure query building methods
 */
export class SqlHelper {
  /**
   * Build a safe IN clause with parameterized values
   *
   * @example
   * const { clause, params } = SqlHelper.buildInClause(['id1', 'id2', 'id3'], 1);
   * // Returns: { clause: '$1, $2, $3', params: ['id1', 'id2', 'id3'] }
   * const query = `SELECT * FROM tasks WHERE id IN (${clause})`;
   * await db.query(query, params);
   */
  static buildInClause(values: any[], paramOffset = 1): { clause: string; params: any[] } {
    if (!values || values.length === 0) {
      return { clause: "", params: [] };
    }

    const placeholders = values.map((_, index) => `$${paramOffset + index}`).join(", ");
    return {
      clause: placeholders,
      params: values,
    };
  }

  /**
   * Build an optional parameterized IN clause for SQL queries with column name.
   * Returns empty clause if values array is empty, making it safe for optional filters.
   * The column name is validated to prevent SQL injection.
   *
   * @param values - Array of values to include in the IN clause (can be empty)
   * @param columnName - Name of the column for the IN clause (will be validated)
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
  static buildOptionalInClause(values: any[], columnName: string, startIndex: number): { clause: string; params: any[] } {
    if (!Array.isArray(values) || values.length === 0) {
      return {
        clause: '',
        params: []
      };
    }

    // Validate columnName to prevent SQL injection
    const safeColumnName = this.escapeIdentifier(columnName);

    const placeholders = values.map((_, index) => `$${startIndex + index}`).join(', ');
    return {
      clause: `AND ${safeColumnName} IN (${placeholders})`,
      params: values
    };
  }

  /**
   * Build a safe WHERE clause with multiple conditions
   * 
   * @example
   * const conditions = [
   *   { field: 'status', operator: '=', value: 'active' },
   *   { field: 'priority', operator: 'IN', value: ['high', 'medium'] }
   * ];
   * const { where, params } = SqlHelper.buildWhereClause(conditions);
   */
  static buildWhereClause(
    conditions: Array<{
      field: string;
      operator: string;
      value: any;
      conjunction?: "AND" | "OR";
    }>,
    paramOffset = 1
  ): { where: string; params: any[] } {
    if (!conditions || conditions.length === 0) {
      return { where: "", params: [] };
    }

    const params: any[] = [];
    const clauses: string[] = [];
    let currentParam = paramOffset;

    conditions.forEach((condition, index) => {
      const conjunction = index === 0 ? "" : ` ${condition.conjunction || "AND"} `;

      if (condition.operator.toUpperCase() === "IN") {
        const values = Array.isArray(condition.value) ? condition.value : [condition.value];
        const { clause, params: inParams } = this.buildInClause(values, currentParam);
        clauses.push(`${conjunction}${condition.field} IN (${clause})`);
        params.push(...inParams);
        currentParam += inParams.length;
      } else if (condition.operator.toUpperCase() === "IS NULL" || condition.operator.toUpperCase() === "IS NOT NULL") {
        clauses.push(`${conjunction}${condition.field} ${condition.operator}`);
      } else {
        clauses.push(`${conjunction}${condition.field} ${condition.operator} $${currentParam}`);
        params.push(condition.value);
        currentParam++;
      }
    });

    return {
      where: clauses.join(""),
      params,
    };
  }

  /**
   * Build a safe LIKE clause for text search
   */
  static buildLikeClause(
    field: string,
    searchTerm: string,
    paramOffset = 1,
    options: {
      caseSensitive?: boolean;
      prefix?: boolean;
      suffix?: boolean;
    } = {}
  ): { clause: string; params: string[] } {
    const { caseSensitive = false, prefix = true, suffix = true } = options;

    let pattern = searchTerm;
    if (prefix) pattern = `%${pattern}`;
    if (suffix) pattern = `${pattern}%`;

    const operator = caseSensitive ? "LIKE" : "ILIKE";

    return {
      clause: `${field} ${operator} $${paramOffset}`,
      params: [pattern],
    };
  }

  /**
   * Build a safe full-text search clause for multiple fields
   */
  static buildSearchClause(
    fields: string[],
    searchTerm: string,
    paramOffset = 1,
    caseSensitive = false
  ): { clause: string; params: string[] } {
    if (!searchTerm || searchTerm.trim() === "") {
      return { clause: "", params: [] };
    }

    const operator = caseSensitive ? "LIKE" : "ILIKE";
    const pattern = `%${searchTerm}%`;
    const clauses = fields.map(field => `${field} ${operator} $${paramOffset}`);

    return {
      clause: `(${clauses.join(" OR ")})`,
      params: [pattern],
    };
  }

  /**
   * Build a safe ORDER BY clause
   */
  static buildOrderByClause(
    field: string,
    order: "ASC" | "DESC" | "asc" | "desc",
    allowedFields: string[]
  ): string {
    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid sort field: ${field}`);
    }

    const normalizedOrder = order.toUpperCase();
    if (normalizedOrder !== "ASC" && normalizedOrder !== "DESC") {
      throw new Error(`Invalid sort order: ${order}`);
    }

    return `${field} ${normalizedOrder}`;
  }

  /**
   * Build a safe LIMIT/OFFSET clause
   */
  static buildPaginationClause(
    limit: number,
    offset: number,
    paramOffset = 1
  ): { clause: string; params: number[] } {
    const safeLimit = Math.max(1, Math.min(1000, parseInt(String(limit), 10) || 10));
    const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);

    return {
      clause: `LIMIT $${paramOffset} OFFSET $${paramOffset + 1}`,
      params: [safeLimit, safeOffset],
    };
  }

  /**
   * Escape identifier (table/column name) for secure query building
   * Supports both simple identifiers (e.g., "status_id") and qualified identifiers (e.g., "p.status_id")
   */
  static escapeIdentifier(identifier: string): string {
    // Handle qualified identifiers (e.g., "p.status_id")
    if (identifier.includes('.')) {
      const segments = identifier.split('.');
      const escapedSegments = segments.map(segment => {
        const cleaned = segment.replace(/"/g, "");

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cleaned)) {
          throw new Error(`Invalid identifier segment: ${segment}`);
        }

        return `"${cleaned}"`;
      });

      return escapedSegments.join('.');
    }

    // Handle simple identifiers
    const cleaned = identifier.replace(/"/g, "");

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cleaned)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }

    return `"${cleaned}"`;
  }

  /**
   * Build a safe UPDATE query
   */
  static buildUpdateQuery(options: {
    table: string;
    set: Record<string, any>;
    where: Array<{ field: string; operator: string; value: any; conjunction?: "AND" | "OR" }>;
  }): ParameterizedQuery {
    const { table, set, where } = options;

    const setEntries = Object.entries(set);
    if (setEntries.length === 0) {
      throw new Error("UPDATE query must have at least one field to set");
    }

    const params: any[] = [];
    let paramOffset = 1;

    const setClauses = setEntries.map(([field, value]) => {
      params.push(value);
      return `${field} = $${paramOffset++}`;
    });

    let query = `UPDATE ${table} SET ${setClauses.join(", ")}`;

    if (where.length > 0) {
      const { where: whereClause, params: whereParams } = this.buildWhereClause(where, paramOffset);
      query += ` WHERE ${whereClause}`;
      params.push(...whereParams);
    }

    return { query, params };
  }
}

/**
 * Legacy flatString replacement - DEPRECATED
 * Use SqlHelper.buildInClause() instead
 * 
 * @deprecated This function is unsafe and will be removed in Phase 3
 */
export function flatString(text: string): string {
  console.warn("flatString() is deprecated and unsafe. Use SqlHelper.buildInClause() instead.");
  return (text || "")
    .split(" ")
    .map((s) => `'${s}'`)
    .join(",");
}

export default SqlHelper;
