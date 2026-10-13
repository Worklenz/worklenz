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
   * Build a safe WHERE clause with multiple conditions
   * 
   * @example
   * const conditions = [
   *   { field: 'status', operator: '=', value: 'active' },
   *   { field: 'priority', operator: 'IN', value: ['high', 'medium'] }
   * ];
   * const { where, params } = SqlHelper.buildWhereClause(conditions);
   */
  private static readonly ALLOWED_OPERATORS = new Set([
    "=", "!=", "<>", "<", "<=", ">", ">=",
    "LIKE", "ILIKE", "NOT LIKE", "NOT ILIKE",
    "IN", "NOT IN", "IS NULL", "IS NOT NULL"
  ]);

  private static readonly ALLOWED_CONJUNCTIONS = new Set(["AND", "OR"]);

  /**
   * Check whether a string is a valid SQL identifier (single name or table.column)
   */
  static isValidIdentifier(identifier: string): boolean {
    if (!identifier || typeof identifier !== "string") {
      return false;
    }
    return identifier.split(".").every(part => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part));
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
      const rawConjunction = (condition.conjunction || "AND").trim().toUpperCase();
      if (!this.ALLOWED_CONJUNCTIONS.has(rawConjunction)) {
        throw new Error(`Invalid SQL conjunction: ${condition.conjunction}`);
      }
      const conjunction = index === 0 ? "" : ` ${rawConjunction} `;

      const operator = condition.operator.trim().toUpperCase();
      if (!this.ALLOWED_OPERATORS.has(operator)) {
        throw new Error(`Invalid SQL operator: ${condition.operator}`);
      }

      const safeField = this.isValidIdentifier(condition.field)
        ? this.escapeIdentifier(condition.field)
        : condition.field;
      
      if (operator === "IN" || operator === "NOT IN") {
        const values = Array.isArray(condition.value) ? condition.value : [condition.value];
        const { clause, params: inParams } = this.buildInClause(values, currentParam);
        clauses.push(`${conjunction}${safeField} ${operator} (${clause})`);
        params.push(...inParams);
        currentParam += inParams.length;
      } else if (operator === "IS NULL" || operator === "IS NOT NULL") {
        clauses.push(`${conjunction}${safeField} ${operator}`);
      } else {
        clauses.push(`${conjunction}${safeField} ${operator} $${currentParam}`);
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
   * Escape identifier (table/column name) for secure query building.
   * Supports both simple identifiers ("column") and qualified names ("table"."column").
   */
  static escapeIdentifier(identifier: string): string {
    if (!identifier || typeof identifier !== "string") {
      throw new Error(`Invalid identifier: ${identifier}`);
    }

    const parts = identifier.split(".");
    for (const part of parts) {
      const cleaned = part.replace(/"/g, "");
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cleaned)) {
        throw new Error(`Invalid identifier: ${identifier}`);
      }
    }

    return parts.map(part => `"${part.replace(/"/g, "")}"`).join(".");
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

    const safeTable = this.isValidIdentifier(table) ? this.escapeIdentifier(table) : table;

    const params: any[] = [];
    let paramOffset = 1;

    const setClauses = setEntries.map(([field, value]) => {
      params.push(value);
      const safeField = this.isValidIdentifier(field) ? this.escapeIdentifier(field) : field;
      return `${safeField} = $${paramOffset++}`;
    });

    let query = `UPDATE ${safeTable} SET ${setClauses.join(", ")}`;

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
    .filter((s) => s.trim().length > 0)
    .map((s) => `'${s.replace(/'/g, "''")}'`)
    .join(",");
}

export default SqlHelper;
