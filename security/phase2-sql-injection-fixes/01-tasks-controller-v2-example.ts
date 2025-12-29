/**

 * This file demonstrates how to replace unsafe flatString() usage
 * with secure parameterized queries using SqlHelper.
 * 
 * BEFORE (UNSAFE):
 * ```typescript
 * private static flatString(text: string) {
 *   return (text || "").split(" ").map((s) => `'${s}'`).join(",");
 * }
 * 
 * private static getFilterByStatusWhereClosure(text: string) {
 *   return text ? `status_id IN (${this.flatString(text)})` : "";
 * }
 * ```
 * 
 * AFTER (SECURE):
 * See implementation below
 */

import { SqlHelper } from "../shared/sql-helpers";

export class TasksControllerV2Example {
  /**
   * SECURE VERSION: Build filter with parameterized values
   * 
   * Instead of returning a string with embedded values, return both
   * the SQL clause and the parameters separately.
   */
  private static getFilterByStatusWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const statusIds = text.split(" ").filter(id => id.trim());
    const { clause, params } = SqlHelper.buildInClause(statusIds, paramOffset);
    
    return {
      clause: `status_id IN (${clause})`,
      params,
    };
  }

  /**
   * SECURE VERSION: Priority filter with subquery
   */
  private static getFilterByPriorityWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const priorityIds = text.split(" ").filter(id => id.trim());
    const { clause: inClause1, params } = SqlHelper.buildInClause(priorityIds, paramOffset);
    const { clause: inClause2 } = SqlHelper.buildInClause(priorityIds, paramOffset);

    const clause = `(
      priority_id IN (${inClause1})
      OR EXISTS (
        SELECT 1 FROM tasks subtask
        WHERE subtask.parent_task_id = t.id
        AND subtask.priority_id IN (${inClause2})
        AND subtask.archived IS FALSE
      )
    )`;

    return { clause, params };
  }

  /**
   * SECURE VERSION: Labels filter
   */
  private static getFilterByLabelsWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const labelIds = text.split(" ").filter(id => id.trim());
    const { clause: inClause1, params } = SqlHelper.buildInClause(labelIds, paramOffset);
    const { clause: inClause2 } = SqlHelper.buildInClause(labelIds, paramOffset);

    const clause = `(
      id IN (SELECT task_id FROM task_labels WHERE label_id IN (${inClause1}))
      OR EXISTS (
        SELECT 1 FROM tasks subtask
        JOIN task_labels tl ON tl.task_id = subtask.id
        WHERE subtask.parent_task_id = t.id
        AND tl.label_id IN (${inClause2})
        AND subtask.archived IS FALSE
      )
    )`;

    return { clause, params };
  }

  /**
   * SECURE VERSION: Members filter
   */
  private static getFilterByMembersWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const memberIds = text.split(" ").filter(id => id.trim());
    const { clause: inClause1, params } = SqlHelper.buildInClause(memberIds, paramOffset);
    const { clause: inClause2 } = SqlHelper.buildInClause(memberIds, paramOffset);

    const clause = `(
      id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${inClause1}))
      OR EXISTS (
        SELECT 1 FROM tasks subtask
        JOIN tasks_assignees ta ON ta.task_id = subtask.id
        WHERE subtask.parent_task_id = t.id
        AND ta.team_member_id IN (${inClause2})
        AND subtask.archived IS FALSE
      )
    )`;

    return { clause, params };
  }

  /**
   * SECURE VERSION: Projects filter
   */
  private static getFilterByProjectsWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const projectIds = text.split(" ").filter(id => id.trim());
    const { clause: inClause, params } = SqlHelper.buildInClause(projectIds, paramOffset);

    return {
      clause: `project_id IN (${inClause})`,
      params,
    };
  }

  /**
   * EXAMPLE: How to use the new secure filters in a query
   */
  private static async getTasksSecure(options: {
    statuses?: string;
    priorities?: string;
    labels?: string;
    members?: string;
    projects?: string;
  }) {
    const params: any[] = [];
    const whereClauses: string[] = [];
    let paramOffset = 1;

    // Build status filter
    if (options.statuses) {
      const { clause, params: statusParams } = this.getFilterByStatusWhereClosure(
        options.statuses,
        paramOffset
      );
      if (clause) {
        whereClauses.push(clause);
        params.push(...statusParams);
        paramOffset += statusParams.length;
      }
    }

    // Build priority filter
    if (options.priorities) {
      const { clause, params: priorityParams } = this.getFilterByPriorityWhereClosure(
        options.priorities,
        paramOffset
      );
      if (clause) {
        whereClauses.push(clause);
        params.push(...priorityParams);
        paramOffset += priorityParams.length;
      }
    }

    // Build labels filter
    if (options.labels) {
      const { clause, params: labelParams } = this.getFilterByLabelsWhereClosure(
        options.labels,
        paramOffset
      );
      if (clause) {
        whereClauses.push(clause);
        params.push(...labelParams);
        paramOffset += labelParams.length;
      }
    }

    // Build members filter
    if (options.members) {
      const { clause, params: memberParams } = this.getFilterByMembersWhereClosure(
        options.members,
        paramOffset
      );
      if (clause) {
        whereClauses.push(clause);
        params.push(...memberParams);
        paramOffset += memberParams.length;
      }
    }

    // Build projects filter
    if (options.projects) {
      const { clause, params: projectParams } = this.getFilterByProjectsWhereClosure(
        options.projects,
        paramOffset
      );
      if (clause) {
        whereClauses.push(clause);
        params.push(...projectParams);
        paramOffset += projectParams.length;
      }
    }

    // Construct final query
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const query = `
      SELECT * FROM tasks t
      ${whereClause}
      ORDER BY created_at DESC
    `;

    // Execute with parameterized values
    // const result = await db.query(query, params);
    // return result.rows;

    return { query, params }; // For demonstration
  }
}

/**
 * KEY CHANGES SUMMARY:
 * 
 * 1. Remove flatString() method entirely
 * 2. Change filter methods to return { clause: string; params: any[] }
 * 3. Add paramOffset parameter to track parameter positions
 * 4. Use SqlHelper.buildInClause() for IN clauses
 * 5. Collect all parameters in an array
 * 6. Pass parameters array to db.query()
 * 
 * MIGRATION STEPS:
 * 
 * 1. Update filter methods to return { clause, params }
 * 2. Update calling code to collect parameters
 * 3. Track parameter offsets correctly
 * 4. Pass collected parameters to db.query()
 * 5. Test thoroughly with various filter combinations
 */
