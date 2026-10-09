import { ParsedQs } from "qs";

import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import {
  TASK_STATUS_COLOR_ALPHA,
  UNMAPPED,
} from "../shared/constants";
import { getColor, humanFileSize, log_error } from "../shared/utils";
import { getStorageUrl } from "../shared/constants";
import { getRootDir } from "../shared/storage";
import { SqlHelper } from "../shared/sql-helpers";
import { isValidUuid } from "../shared/validation-helpers";
import {
  AssigneeTaskScope,
  buildAssigneeScopeFilter,
  buildAssigneeScopedProgressExpression,
  buildAssigneeScopeReadonlyExpression,
  resolveAssigneeTaskScope,
} from "../shared/assignee-task-scope";
import TasksControllerBase, {
  GroupBy,
  ITaskGroup,
  UNASSIGNED_GROUP_ID,
} from "./tasks-controller-base";

const normalizePeopleCustomColumnValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) return [];

    try {
      const parsedValue = JSON.parse(trimmedValue);
      if (Array.isArray(parsedValue)) {
        return parsedValue.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      return [trimmedValue];
    }

    return [];
  }

  return [];
};

export class TaskListGroup implements ITaskGroup {
  name: string;
  category_id: string | null;
  color_code: string;
  color_code_dark: string;
  start_date?: string;
  end_date?: string;
  todo_progress: number;
  doing_progress: number;
  done_progress: number;
  tasks: any[];

  constructor(group: any) {
    this.name = group.name;
    this.category_id = group.category_id || null;
    this.start_date = group.start_date || null;
    this.end_date = group.end_date || null;
    this.color_code = group.color_code + TASK_STATUS_COLOR_ALPHA;
    this.color_code_dark = group.color_code_dark;
    this.todo_progress = 0;
    this.doing_progress = 0;
    this.done_progress = 0;
    this.tasks = [];
  }
}

export default class TasksControllerV2 extends TasksControllerBase {
  private static isCountsOnly(query: ParsedQs) {
    return query.count === "true";
  }

  public static isTasksOnlyReq(query: ParsedQs) {
    return TasksControllerV2.isCountsOnly(query) || query.parent_task;
  }

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
   * Filters tasks by priority.
   * Only tasks whose own priority matches the filter are included.
   * Sub-tasks are fetched separately and filtered independently.
   * Uses parameterized queries.
   */
  private static getFilterByPriorityWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const priorityIds = text.split(" ").filter(id => id.trim());
    const { clause: inClause, params } = SqlHelper.buildInClause(priorityIds, paramOffset);

    const clause = `priority_id IN (${inClause})`;

    return { clause, params };
  }

  /**
   * Filters tasks by labels.
   * Only tasks that directly have a matching label are included.
   * Sub-tasks are fetched separately and filtered independently.
   * Uses parameterized queries.
   */
  private static getFilterByLabelsWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const labelIds = text.split(" ").filter(id => id.trim());
    const { clause: inClause, params } = SqlHelper.buildInClause(labelIds, paramOffset);

    const clause = `id IN (SELECT task_id FROM task_labels WHERE label_id IN (${inClause}))`;

    return { clause, params };
  }

  /**
   * Filters tasks by assigned members.
   * Only tasks that are directly assigned to a matching member are included.
   * Sub-tasks are fetched separately and filtered independently.
   * Uses parameterized queries.
   */
  private static getFilterByMembersWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const memberIds = text.split(" ").filter(id => id.trim());
    const { clause: inClause, params } = SqlHelper.buildInClause(memberIds, paramOffset);

    const clause = `id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${inClause}))`;

    return { clause, params };
  }

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

  private static buildPhaseFilterClause(
    text: string,
    taskAlias: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };

    const tokens = text.split(" ").filter(id => id.trim());
    if (!tokens.length) return { clause: "", params: [] };

    const includeUnmapped = tokens.some(
      token => token === UNMAPPED || token.toLowerCase() === "unmapped"
    );
    const phaseIds = tokens.filter(
      token => token !== UNMAPPED && token.toLowerCase() !== "unmapped"
    );

    const clauses: string[] = [];
    const params: string[] = [];
    let offset = paramOffset;

    if (phaseIds.length) {
      const { clause: inClause, params: inParams } = SqlHelper.buildInClause(phaseIds, offset);
      clauses.push(
        `(SELECT phase_id FROM task_phase WHERE task_id = ${taskAlias}.id) IN (${inClause})`
      );
      params.push(...inParams);
      offset += inParams.length;
    }

    if (includeUnmapped) {
      clauses.push(`NOT EXISTS (SELECT 1 FROM task_phase WHERE task_id = ${taskAlias}.id)`);
    }

    if (!clauses.length) return { clause: "", params: [] };

    return {
      clause: `(${clauses.join(" OR ")})`,
      params,
    };
  }

  private static getFilterByPhaseWhereClosure(
    text: string,
    paramOffset: number = 1
  ): { clause: string; params: string[] } {
    return TasksControllerV2.buildPhaseFilterClause(text, "t", paramOffset);
  }

  private static getFilterByEpicWhereClosure(
    epicId: string | undefined,
    paramOffset: number
  ): { clause: string; params: string[] } {
    const trimmed = epicId?.trim();
    if (!trimmed || !isValidUuid(trimmed)) return { clause: "", params: [] };
    return { clause: `t.epic_id = $${paramOffset}::UUID`, params: [trimmed] };
  }

  /**
   * Software-project quick filters ("mine bugs blocked"). Unknown tokens are ignored and
   * no request values are interpolated; "mine" matches the requesting user ($1).
   */
  private static getFilterByQuickFiltersWhereClosure(quickFilters: string | undefined): string {
    const tokens = new Set((quickFilters || "").split(" ").map(token => token.trim()));
    const clauses: string[] = [];
    if (tokens.has("mine")) {
      clauses.push(`t.id IN (
        SELECT ta.task_id FROM tasks_assignees ta
        INNER JOIN team_members tm ON tm.id = ta.team_member_id
        WHERE tm.user_id = $1::UUID)`);
    }
    if (tokens.has("bugs")) clauses.push("t.issue_type = 'bug'");
    if (tokens.has("blocked")) clauses.push("t.is_blocked IS TRUE");
    return clauses.join(" AND ");
  }

  private static getFilterByAssignee(filterBy: string, projectIdParam: number) {
    return filterBy === "member"
      ? `id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id = $1::UUID)`
      : projectIdParam > 0 ? `project_id = $${projectIdParam}::UUID` : "1 = 1";
  }

  private static getStatusesQuery(filterBy: string) {
    return filterBy === "member"
      ? `, (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
      FROM (SELECT task_statuses.id, task_statuses.name, stsc.color_code
          FROM task_statuses
              INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
          WHERE project_id = t.project_id
          ORDER BY task_statuses.name) rec) AS statuses`
      : "";
  }

  public static async getTaskCompleteRatio(taskId: string): Promise<{
    ratio: number;
    total_completed: number;
    total_tasks: number;
  } | null> {
    try {
      const result = await db.query(
        "SELECT get_task_complete_ratio($1) AS info;",
        [taskId]
      );
      const [data] = result.rows;
      if (data && data.info && data.info.ratio !== undefined) {
        data.info.ratio = +(data.info.ratio || 0).toFixed();
        return data.info;
      }
      return null;
    } catch (error) {
      log_error(`Error in getTaskCompleteRatio: ${error}`);
      return null;
    }
  }

  private static getQuery(
    userId: string,
    options: ParsedQs,
    projectId?: string,
    assigneeScope?: AssigneeTaskScope
  ): { query: string; params: any[]; isSubTasks: boolean } {
    const queryParams: any[] = [userId]; // $1 is always userId
    let paramOffset = 2; // Start at $2 (after userId)

    // Add project_id parameter if provided
    let projectIdParam = 0;
    if (projectId) {
      queryParams.push(projectId);
      projectIdParam = paramOffset++;
    }

    // Add parent_task parameter early if fetching subtasks (before other filters to maintain parameter positions)
    const isSubTasks = !!options.parent_task;
    let parentTaskParam = 0;
    if (isSubTasks && options.parent_task) {
      queryParams.push(options.parent_task as string);
      parentTaskParam = paramOffset++;
    }

    // Determine which sort column to use based on grouping
    const groupBy = options.group || "status";
    let defaultSortColumn = "sort_order";
    switch (groupBy) {
      case "status":
        defaultSortColumn = "status_sort_order";
        break;
      case "priority":
        defaultSortColumn = "priority_sort_order";
        break;
      case "phase":
        defaultSortColumn = "phase_sort_order";
        break;
      default:
        defaultSortColumn = "sort_order";
    }

    const searchField = options.search
      ? [
        "t.name",
        "CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no)",
      ]
      : defaultSortColumn;
    const { searchQuery, sortField, sortOrder } =
      TasksControllerV2.toPaginationOptions(options, searchField);

    // Map frontend field names to backend column names
    const fieldMapping: Record<string, string> = {
      'task_key': 'CAST(t.task_no AS INTEGER)',
      'name': 't.name',
      'status': '(SELECT sort_order FROM task_statuses WHERE id = t.status_id)',
      'priority': '(SELECT value FROM task_priorities WHERE id = t.priority_id)',
      'start_date': 't.start_date',
      'end_date': 't.end_date',
      'completed_at': 't.completed_at',
      'created_at': "t.created_at",
      'updated_at': "t.updated_at",
      'attachments_count': '(SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id)',
    };

    // Apply field mapping if needed
    let mappedSortField = sortField;
    if (typeof sortField === "string" && sortField !== defaultSortColumn) {
      if (fieldMapping[sortField]) {
        mappedSortField = fieldMapping[sortField];
      }
    }

    // Construct final sort clause
    const sortFields =
      mappedSortField && sortOrder
        ? `${mappedSortField} ${sortOrder.toUpperCase()}`
        : defaultSortColumn;

    const statusesResult = TasksControllerV2.getFilterByStatusWhereClosure(
      options.statuses as string,
      paramOffset
    );
    if (statusesResult.params.length > 0) {
      queryParams.push(...statusesResult.params);
      paramOffset += statusesResult.params.length;
    }

    const labelsResult = TasksControllerV2.getFilterByLabelsWhereClosure(
      options.labels as string,
      paramOffset
    );
    if (labelsResult.params.length > 0) {
      queryParams.push(...labelsResult.params);
      paramOffset += labelsResult.params.length;
    }

    const membersResult = TasksControllerV2.getFilterByMembersWhereClosure(
      options.members as string,
      paramOffset
    );
    if (membersResult.params.length > 0) {
      queryParams.push(...membersResult.params);
      paramOffset += membersResult.params.length;
    }

    const assigneeScopeMemberParamIndex =
      assigneeScope?.applyFilter && assigneeScope.teamMemberId
        ? paramOffset
        : null;
    const assigneeScopeResult = buildAssigneeScopeFilter(
      assigneeScope || { applyFilter: false, teamMemberId: null },
      "t.id",
      paramOffset
    );
    if (assigneeScopeResult.params.length > 0) {
      queryParams.push(...assigneeScopeResult.params);
      paramOffset += assigneeScopeResult.params.length;
    }

    const assigneeScopeReadonlySelect = assigneeScopeMemberParamIndex
      ? buildAssigneeScopeReadonlyExpression("t.id", assigneeScopeMemberParamIndex)
      : "FALSE";

    // TVR-15: when assignee-scope applies, progress % must ignore non-visible subtasks.
    // The scoped expression only references t.id, so it is evaluated in the base CTE;
    // otherwise progress is derived from the joined status category in the outer query.
    const scopedProgressSelect = assigneeScopeMemberParamIndex
      ? buildAssigneeScopedProgressExpression("t.id", assigneeScopeMemberParamIndex)
      : null;
    const baseProgressColumns = scopedProgressSelect
      ? `, ${scopedProgressSelect} AS progress_value, ${scopedProgressSelect} AS complete_ratio`
      : ", t.progress_value";
    const outerProgressColumns = scopedProgressSelect
      ? "t.progress_value, t.complete_ratio"
      : `CASE WHEN t.archived IS FALSE AND stsc.is_done IS TRUE THEN 100 ELSE t.progress_value END AS progress_value,
             CASE WHEN t.archived IS FALSE AND stsc.is_done IS TRUE THEN 100 ELSE COALESCE(t.progress_value, 0) END AS complete_ratio`;

    const projectsResult = TasksControllerV2.getFilterByProjectsWhereClosure(
      options.projects as string,
      paramOffset
    );
    if (projectsResult.params.length > 0) {
      queryParams.push(...projectsResult.params);
      paramOffset += projectsResult.params.length;
    }

    const priorityResult = TasksControllerV2.getFilterByPriorityWhereClosure(
      options.priorities as string,
      paramOffset
    );
    if (priorityResult.params.length > 0) {
      queryParams.push(...priorityResult.params);
      paramOffset += priorityResult.params.length;
    }

    const phaseResult = TasksControllerV2.getFilterByPhaseWhereClosure(
      options.phases as string,
      paramOffset
    );
    if (phaseResult.params.length > 0) {
      queryParams.push(...phaseResult.params);
      paramOffset += phaseResult.params.length;
    }

    const epicResult = TasksControllerV2.getFilterByEpicWhereClosure(
      options.epics as string,
      paramOffset
    );
    if (epicResult.params.length > 0) {
      queryParams.push(...epicResult.params);
      paramOffset += epicResult.params.length;
    }

    let enhancedSearchQuery = searchQuery;
    let searchParamNum = 0;
    // Recursive descendant walks are hoisted into top-level CTEs that run once per
    // request. Each CTE collects the ancestors of every matching task, so the main
    // query only needs a membership test instead of a per-row recursive traversal.
    const ancestorCtes: string[] = [];
    const descendantProjectScope =
      projectIdParam > 0 ? `AND td.project_id = $${projectIdParam}::UUID` : "";

    if (options.search) {
      const searchTerm = options.search.toString().trim();
      if (searchTerm) {
        const searchParam = `%${searchTerm}%`;
        queryParams.push(searchParam);
        searchParamNum = paramOffset++;

        ancestorCtes.push(`search_ancestors AS (
          SELECT td.parent_task_id AS id
          FROM tasks td
          WHERE td.archived IS FALSE
            AND td.parent_task_id IS NOT NULL
            ${descendantProjectScope}
            AND (
              td.name ILIKE $${searchParamNum}
              OR CONCAT((SELECT key FROM projects WHERE id = td.project_id), '-', td.task_no) ILIKE $${searchParamNum}
            )
          UNION
          SELECT p.parent_task_id
          FROM tasks p
          INNER JOIN search_ancestors sa ON p.id = sa.id
          WHERE p.archived IS FALSE AND p.parent_task_id IS NOT NULL
        )`);

        enhancedSearchQuery = `AND (
      t.name ILIKE $${searchParamNum}
      OR CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no) ILIKE $${searchParamNum}
      OR t.id IN (SELECT id FROM search_ancestors)
    )`;
      }
    }
    // Filter tasks by a single assignee
    const filterByAssignee = TasksControllerV2.getFilterByAssignee(
      options.filterBy as string,
      projectIdParam
    );
    // Returns statuses of each task as a json array if filterBy === "member"
    const statusesQuery = TasksControllerV2.getStatusesQuery(
      options.filterBy as string
    );

    // Custom columns data query
    const customColumnsQuery = options.customColumns
      ? `, (SELECT COALESCE(
            jsonb_object_agg(
              custom_cols.key,
              custom_cols.value
            ),
            '{}'::JSONB
          )
          FROM (
            SELECT
              cc.key,
              CASE
                WHEN ccv.text_value IS NOT NULL THEN to_jsonb(ccv.text_value)
                WHEN ccv.number_value IS NOT NULL THEN to_jsonb(ccv.number_value)
                WHEN ccv.boolean_value IS NOT NULL THEN to_jsonb(ccv.boolean_value)
                WHEN ccv.date_value IS NOT NULL THEN to_jsonb(ccv.date_value)
                WHEN ccv.json_value IS NOT NULL THEN ccv.json_value
                ELSE NULL::JSONB
              END AS value
            FROM cc_column_values ccv
            JOIN cc_custom_columns cc ON ccv.column_id = cc.id
            WHERE ccv.task_id = t.id
          ) AS custom_cols
          WHERE custom_cols.value IS NOT NULL) AS custom_column_values`
      : "";

    const archivedFilter =
      options.archived === "true" ? "archived IS TRUE" : "archived IS FALSE";

    const quickFiltersClause = TasksControllerV2.getFilterByQuickFiltersWhereClosure(
      typeof options.quick_filters === "string" ? options.quick_filters : undefined
    );

    // Add project_id filter if projectId is provided
    const projectIdFilter = projectIdParam > 0 ? `t.project_id = $${projectIdParam}::UUID` : "";

    // Handle subtask filter - parent_task parameter was already added earlier if needed
    let subTasksFilter;
    if (options.isSubtasksInclude === "true") {
      subTasksFilter = "";
    } else {
      if (isSubTasks && parentTaskParam > 0) {
        // Use the parent_task parameter that was already added to queryParams
        subTasksFilter = `parent_task_id = $${parentTaskParam}::UUID`;
      } else if (isSubTasks) {
        // Fallback: if parent_task is not provided, this shouldn't happen but handle gracefully
        subTasksFilter = "1 = 0"; // Return no results
      } else if (options.archived === "true") {
        // In archived mode we need archived subtasks too, so they can be shown under parent containers.
        subTasksFilter = "(parent_task_id IS NULL OR parent_task_id IS NOT NULL)";
      } else {
        // When filters are active, also include sub-tasks that directly match the filter
        // so they surface at the top level (e.g. filtering by Low priority shows a Low
        // sub-task even when its parent is not Low).
        // Without active filters, only show top-level tasks (parent_task_id IS NULL).
        const hasDirectFilters = !!(
          options.priorities || options.labels || options.members || options.statuses || options.phases || quickFiltersClause
        );
        if (hasDirectFilters) {
          subTasksFilter = "(parent_task_id IS NULL OR parent_task_id IS NOT NULL)";
        } else {
          subTasksFilter = "parent_task_id IS NULL";
        }
      }
    }

    const filters = [
      projectIdFilter,
      subTasksFilter,
      archivedFilter,
      isSubTasks ? "1 = 1" : filterByAssignee,
      statusesResult.clause,
      priorityResult.clause,
      phaseResult.clause,
      epicResult.clause,
      quickFiltersClause,
      labelsResult.clause,
      membersResult.clause,
      assigneeScopeResult.clause,
      projectsResult.clause,
    ]
      .filter((i) => !!i)
      .join(" AND ");

    // Build filtered subtask count query - apply same filters to subtasks
    const subtaskFilters = [];

    // Always filter by archived status for subtasks
    subtaskFilters.push(archivedFilter);

    // Apply status filter to subtasks if present
    if (statusesResult.clause) {
      subtaskFilters.push(statusesResult.clause.replace(/\bt\./g, 'subtask.'));
    }

    // Apply priority filter to subtasks if present (reuse parameters).
    // Param positions are recomputed from scratch (base + preceding filters'
    // param counts) rather than derived from `paramOffset`, since by this point
    // `paramOffset` may have already been advanced past the search param.
    if (options.priorities && priorityResult.clause) {
      const priorityIds = (options.priorities as string).split(" ").filter(id => id.trim());
      let priorityParamStart = 2;
      if (projectId) priorityParamStart++;
      if (isSubTasks && options.parent_task) priorityParamStart++;
      priorityParamStart += statusesResult.params.length;
      priorityParamStart += labelsResult.params.length;
      priorityParamStart += membersResult.params.length;
      priorityParamStart += assigneeScopeResult.params.length;
      priorityParamStart += projectsResult.params.length;
      const { clause: inClause } = SqlHelper.buildInClause(priorityIds, priorityParamStart);
      subtaskFilters.push(`subtask.priority_id IN (${inClause})`);
    }

    // Apply phase filter to subtasks if present (reuse parameters)
    if (options.phases && phaseResult.clause) {
      let phaseParamStart = 2;
      if (projectId) phaseParamStart++;
      if (isSubTasks && options.parent_task) phaseParamStart++;
      phaseParamStart += statusesResult.params.length;
      phaseParamStart += labelsResult.params.length;
      phaseParamStart += membersResult.params.length;
      phaseParamStart += assigneeScopeResult.params.length;
      phaseParamStart += projectsResult.params.length;
      phaseParamStart += priorityResult.params.length;
      const subtaskPhaseFilter = TasksControllerV2.buildPhaseFilterClause(
        options.phases as string,
        "subtask",
        phaseParamStart
      );
      if (subtaskPhaseFilter.clause) {
        subtaskFilters.push(subtaskPhaseFilter.clause);
      }
    }

    // Apply labels filter to subtasks if present (reuse parameters)
    if (options.labels && labelsResult.clause) {
      const labelIds = (options.labels as string).split(" ").filter(id => id.trim());
      let labelParamStart = 2;
      if (projectId) labelParamStart++;
      if (isSubTasks && options.parent_task) labelParamStart++;
      labelParamStart += statusesResult.params.length;
      const { clause: inClause } = SqlHelper.buildInClause(labelIds, labelParamStart);
      subtaskFilters.push(`subtask.id IN (SELECT task_id FROM task_labels WHERE label_id IN (${inClause}))`);
    }

    // Apply members filter to subtasks if present (reuse parameters)
    if (options.members && membersResult.clause) {
      const memberIds = (options.members as string).split(" ").filter(id => id.trim());
      let memberParamStart = 2;
      if (projectId) memberParamStart++;
      if (isSubTasks && options.parent_task) memberParamStart++;
      memberParamStart += statusesResult.params.length;
      memberParamStart += labelsResult.params.length;
      const { clause: inClause } = SqlHelper.buildInClause(memberIds, memberParamStart);
      subtaskFilters.push(`subtask.id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${inClause}))`);
    }

    // Assignee-scope restriction for subtasks (same $N as main filter)
    if (assigneeScopeResult.clause) {
      if (assigneeScopeResult.params.length > 0) {
        let assigneeParamStart = 2;
        if (projectId) assigneeParamStart++;
        if (isSubTasks && options.parent_task) assigneeParamStart++;
        assigneeParamStart += statusesResult.params.length;
        assigneeParamStart += labelsResult.params.length;
        assigneeParamStart += membersResult.params.length;
        subtaskFilters.push(
          `(
            subtask.id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id = $${assigneeParamStart}::UUID)
            OR subtask.id IN (
              SELECT parent_task_id FROM tasks
              WHERE parent_task_id IS NOT NULL
                AND id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id = $${assigneeParamStart}::UUID)
            )
          )`
        );
      } else {
        subtaskFilters.push("1 = 0");
      }
    }

    // Apply search filter to subtasks if present (reuse search parameter)
    if (options.search && !isSubTasks && searchParamNum > 0) {
      subtaskFilters.push(`(
        subtask.name ILIKE $${searchParamNum}
        OR CONCAT((SELECT key FROM projects WHERE id = subtask.project_id), '-', subtask.task_no) ILIKE $${searchParamNum}
      )`);
    }

    const subtaskFilterClause =
      subtaskFilters.length > 0 ? `AND ${subtaskFilters.join(" AND ")}` : "";

    // Build has_filtered_children query - checks if any descendant (at any level) matches the active filters
    // This is used to auto-expand parent tasks when their descendants match filters
    const hasActiveFilters = !!(options.priorities || options.labels || options.members || options.phases || options.statuses || (options.search && !isSubTasks));

    let hasFilteredChildrenQuery = "FALSE";
    if (hasActiveFilters) {
      const descendantFilterConditions: string[] = [];

      // Build filter conditions for descendants using the same parameter positions
      if (options.priorities) {
        const priorityIds = (options.priorities as string).split(" ").filter(id => id.trim());
        // Find the parameter positions for priority IDs (they were added after statuses, labels, members, projects, phases)
        let priorityParamStart = 2; // Start after userId
        if (projectId) priorityParamStart++;
        if (isSubTasks && options.parent_task) priorityParamStart++;
        priorityParamStart += statusesResult.params.length;
        priorityParamStart += labelsResult.params.length;
        priorityParamStart += membersResult.params.length;
        priorityParamStart += assigneeScopeResult.params.length;
        priorityParamStart += projectsResult.params.length;

        const { clause: inClause } = SqlHelper.buildInClause(priorityIds, priorityParamStart);
        descendantFilterConditions.push(`td.priority_id IN (${inClause})`);
      }

      if (options.labels) {
        const labelIds = (options.labels as string).split(" ").filter(id => id.trim());
        let labelParamStart = 2;
        if (projectId) labelParamStart++;
        if (isSubTasks && options.parent_task) labelParamStart++;
        labelParamStart += statusesResult.params.length;

        const { clause: inClause } = SqlHelper.buildInClause(labelIds, labelParamStart);
        descendantFilterConditions.push(`td.id IN (SELECT task_id FROM task_labels WHERE label_id IN (${inClause}))`);
      }

      if (options.members) {
        const memberIds = (options.members as string).split(" ").filter(id => id.trim());
        let memberParamStart = 2;
        if (projectId) memberParamStart++;
        if (isSubTasks && options.parent_task) memberParamStart++;
        memberParamStart += statusesResult.params.length;
        memberParamStart += labelsResult.params.length;

        const { clause: inClause } = SqlHelper.buildInClause(memberIds, memberParamStart);
        descendantFilterConditions.push(`td.id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${inClause}))`);
      }

      if (options.search && !isSubTasks && searchParamNum > 0) {
        descendantFilterConditions.push(`(
          td.name ILIKE $${searchParamNum}
          OR CONCAT((SELECT key FROM projects WHERE id = td.project_id), '-', td.task_no) ILIKE $${searchParamNum}
        )`);
      }

      // Status filter for descendants
      if (options.statuses) {
        const statusIds = (options.statuses as string).split(" ").filter(id => id.trim());
        let statusParamStart = 2;
        if (projectId) statusParamStart++;
        if (isSubTasks && options.parent_task) statusParamStart++;

        const { clause: inClause } = SqlHelper.buildInClause(statusIds, statusParamStart);
        descendantFilterConditions.push(`td.status_id IN (${inClause})`);
      }

      // Phase filter for descendants — phase lives in the task_phase join table,
      // so we use a correlated subquery against td.id
      if (options.phases) {
        let phaseParamStart = 2;
        if (projectId) phaseParamStart++;
        if (isSubTasks && options.parent_task) phaseParamStart++;
        phaseParamStart += statusesResult.params.length;
        phaseParamStart += labelsResult.params.length;
        phaseParamStart += membersResult.params.length;
        phaseParamStart += assigneeScopeResult.params.length;
        phaseParamStart += projectsResult.params.length;
        phaseParamStart += priorityResult.params.length;

        const descendantPhaseFilter = TasksControllerV2.buildPhaseFilterClause(
          options.phases as string,
          "td",
          phaseParamStart
        );
        if (descendantPhaseFilter.clause) {
          descendantFilterConditions.push(descendantPhaseFilter.clause);
        }
      }

      if (descendantFilterConditions.length > 0) {
        const descendantFilterClause = descendantFilterConditions.join(" OR ");
        ancestorCtes.push(`filtered_ancestors AS (
          SELECT td.parent_task_id AS id
          FROM tasks td
          WHERE td.archived IS FALSE
            AND td.parent_task_id IS NOT NULL
            ${descendantProjectScope}
            AND (${descendantFilterClause})
          UNION
          SELECT p.parent_task_id
          FROM tasks p
          INNER JOIN filtered_ancestors fa ON p.id = fa.id
          WHERE p.archived IS FALSE AND p.parent_task_id IS NOT NULL
        )`);
        hasFilteredChildrenQuery = "EXISTS (SELECT 1 FROM filtered_ancestors fa WHERE fa.id = t.id)";
      }
    }

    // The dynamic filter/sort fragments above use unqualified column names, so they
    // are evaluated in a base CTE where `tasks t` is the only relation in scope.
    // The outer query then joins the 1:1 lookups (project, parent, status, priority,
    // phase, reporter) that were previously correlated scalar subqueries per row.
    const passThroughColumns = [
      options.customColumns ? "t.custom_column_values" : "",
      options.filterBy === "member" ? "t.statuses" : "",
    ]
      .filter((c) => !!c)
      .map((c) => `, ${c}`)
      .join("");

    const baseCte = `base AS (
      SELECT t.id,
             t.name,
             t.description,
             t.task_no,
             t.project_id,
             t.parent_task_id,
             t.status_id,
             t.priority_id,
             t.reporter_id,
             t.archived,
             t.sort_order,
             t.status_sort_order,
             t.priority_sort_order,
             t.phase_sort_order,
             t.manual_progress,
             t.weight,
             t.total_minutes,
             t.created_at,
             t.updated_at,
             t.completed_at,
             t.start_date,
             t.end_date,
             t.billable,
             t.schedule_id,
             t.due_time,
             t.epic_id,
             t.story_points,
             t.is_blocked,
             t.issue_type,
             ROW_NUMBER() OVER (ORDER BY ${sortFields}, t.sort_order, t.created_at) AS sort_rank,
             ${assigneeScopeReadonlySelect} AS assignee_scope_readonly
             ${baseProgressColumns} ${customColumnsQuery} ${statusesQuery}
      FROM tasks t
      WHERE ${filters} ${enhancedSearchQuery}
    )`;

    // Per-row correlated aggregates are replaced by one grouped pass each, scoped to
    // the rows the base CTE actually returns. Each aggregate gets its own CTE —
    // joining them together before aggregating would fan out and inflate SUM().
    const aggregateCtes = [
      `comments_agg AS (
        SELECT task_id, COUNT(*) AS comments_count
        FROM task_comments WHERE task_id IN (SELECT id FROM base) GROUP BY task_id
      )`,
      `latest_comment_agg AS (
        SELECT DISTINCT ON (tc.task_id)
               tc.task_id,
               tcc.text_content AS latest_comment,
               tc.created_at AS latest_comment_at,
               COALESCE(u.name, '') AS latest_comment_author
        FROM task_comments tc
        INNER JOIN task_comment_contents tcc
                ON tcc.comment_id = tc.id
               AND tcc.text_content IS NOT NULL
               AND BTRIM(tcc.text_content) <> ''
        LEFT JOIN users u ON u.id = tc.user_id
        WHERE tc.task_id IN (SELECT id FROM base)
          AND COALESCE(tc.is_deleted, FALSE) IS FALSE
        ORDER BY tc.task_id, tc.created_at DESC, tcc.index DESC
      )`,
      `attachments_agg AS (
        SELECT ta.task_id,
               COUNT(*) AS attachments_count,
               COALESCE(JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', ta.id,
                   'name', ta.name,
                   'size', ta.size,
                   'url', CONCAT('${getStorageUrl()}/${getRootDir()}', '/', ta.team_id, '/', ta.project_id, '/', ta.id, '.', ta.type),
                   'type', ta.type,
                   'created_at', ta.created_at,
                   'uploader_name', u.name
                 ) ORDER BY ta.created_at ASC
               ), '[]'::JSON) AS attachments
        FROM task_attachments ta
        LEFT JOIN users u ON u.id = ta.uploaded_by
        WHERE ta.task_id IN (SELECT id FROM base)
        GROUP BY ta.task_id
      )`,
      `worklog_agg AS (
        SELECT task_id, SUM(time_spent) AS total_minutes_spent
        FROM task_work_log WHERE task_id IN (SELECT id FROM base) GROUP BY task_id
      )`,
      `subscribers_agg AS (
        SELECT DISTINCT task_id FROM task_subscribers WHERE task_id IN (SELECT id FROM base)
      )`,
      `dependencies_agg AS (
        SELECT DISTINCT task_id FROM task_dependencies WHERE task_id IN (SELECT id FROM base)
      )`,
      `timers_agg AS (
        SELECT task_id, MIN(start_time) AS start_time
        FROM task_timers WHERE user_id = $1 AND task_id IN (SELECT id FROM base) GROUP BY task_id
      )`,
      `completed_children_agg AS (
        SELECT c.parent_task_id, COUNT(*)::INT AS completed_sub_tasks
        FROM tasks c
        INNER JOIN task_statuses cs ON cs.id = c.status_id
        INNER JOIN sys_task_status_categories cc ON cc.id = cs.category_id
        WHERE c.parent_task_id IN (SELECT id FROM base)
          AND c.archived IS FALSE AND cc.is_done IS TRUE
        GROUP BY c.parent_task_id
      )`,
      // Replaces get_task_assignees(t.id). The per-row PL/pgSQL call re-scanned
      // notification_settings and team_member_info_view once per task; here every
      // lookup is joined a single time for the whole result set. The inner LATERAL
      // defines the exact JSON shape so task_id stays out of the emitted objects.
      `assignees_agg AS (
        SELECT r.task_id, COALESCE(JSON_AGG(r.assignee), '[]'::JSON) AS assignees
        FROM (
          SELECT ta.task_id, ROW_TO_JSON(shape) AS assignee
          FROM tasks_assignees ta
          INNER JOIN team_members tm ON tm.id = ta.team_member_id
          LEFT JOIN users u ON u.id = tm.user_id
          LEFT JOIN notification_settings ns ON ns.team_id = tm.team_id AND ns.user_id = u.id
          CROSS JOIN LATERAL (
            SELECT ta.team_member_id,
                   ta.project_member_id,
                   COALESCE(u.name,
                            (SELECT ei.name FROM email_invitations ei WHERE ei.team_member_id = tm.id),
                            '') AS name,
                   COALESCE(ns.email_notifications_enabled, FALSE) AS email_notifications_enabled,
                   COALESCE(u.avatar_url, '') AS avatar_url,
                   u.id AS user_id,
                   COALESCE(u.email, '') AS email,
                   COALESCE(u.socket_id, '') AS socket_id,
                   tm.team_id
          ) shape
          WHERE ta.task_id IN (SELECT id FROM base)
        ) r
        GROUP BY r.task_id
      )`,
    ];

    const q = `
      WITH RECURSIVE ${[...ancestorCtes, baseCte, ...aggregateCtes].join(",\n")}
      SELECT t.id,
             t.name,
             CONCAT(pj.key, '-', t.task_no) AS task_key,
             pj.name AS project_name,
             t.project_id,
             t.parent_task_id,
             t.parent_task_id IS NOT NULL AS is_sub_task,
             t.assignee_scope_readonly,
             pt.name AS parent_task_name,
             CASE WHEN pt.id IS NULL THEN NULL ELSE CONCAT(pj.key, '-', pt.task_no) END AS parent_task_key,
             pt.archived AS parent_task_archived,
             pt.status_id AS parent_task_status_id,
             LOWER(REPLACE(pts.name, ' ', '_')) AS parent_task_status_name,
             pt.priority_id AS parent_task_priority_id,
             ptp.value AS parent_task_priority_value,
             ptp.color_code AS parent_task_priority_color,
             CASE WHEN pt.id IS NULL THEN NULL ELSE pt.parent_task_id IS NOT NULL END AS parent_is_subtask,
             (SELECT COUNT(*)::INT
              FROM tasks subtask
              WHERE subtask.parent_task_id = t.id
              ${subtaskFilterClause}) AS sub_tasks_count,
             ${hasFilteredChildrenQuery} AS has_filtered_children,

             t.status_id AS status,
             t.archived,
             t.description,
             t.sort_order,
             t.status_sort_order,
             t.priority_sort_order,
             t.phase_sort_order,
             ${outerProgressColumns},
             t.manual_progress,
             t.weight,
             pj.use_manual_progress AS project_use_manual_progress,
             pj.use_weighted_progress AS project_use_weighted_progress,
             pj.use_time_progress AS project_use_time_progress,

             tph.phase_id,
             pph.name AS phase_name,
             pph.color_code AS phase_color_code,
             t.epic_id,
             t.story_points,
             t.is_blocked,
             t.issue_type,

             sub.task_id IS NOT NULL AS has_subscribers,
             dep.task_id IS NOT NULL AS has_dependencies,
             tmr.start_time AS timer_start_time,

             COALESCE(ts.color_code, stsc.color_code)                       AS status_color,
             COALESCE(ts.color_code, stsc.color_code_dark, stsc.color_code) AS status_color_dark,
             CASE WHEN stsc.id IS NULL THEN '{}'::JSON
                  ELSE JSON_BUILD_OBJECT('is_done', stsc.is_done, 'is_doing', stsc.is_doing, 'is_todo', stsc.is_todo)
             END AS status_category,

             COALESCE(cma.comments_count, 0) AS comments_count,
             COALESCE(ata.attachments_count, 0) AS attachments_count,
             COALESCE(ata.attachments, '[]'::JSON) AS attachments,
             lc.latest_comment,
             lc.latest_comment_at,
             lc.latest_comment_author,
             CASE WHEN t.archived IS FALSE AND stsc.is_done IS TRUE THEN 1 ELSE 0 END AS parent_task_completed,
             COALESCE(asg.assignees, '[]'::JSON) AS assignees,
             COALESCE(cca.completed_sub_tasks, 0) AS completed_sub_tasks,
             lbl.labels,
             COALESCE(stsc.is_done IS TRUE AND ts.project_id = t.project_id, FALSE) AS is_complete,
             ru.name AS reporter,
             tp.id AS priority,
             tp.value AS priority_value,
             tp.color_code AS priority_color,
             t.total_minutes,
             wla.total_minutes_spent,
             t.created_at,
             t.updated_at,
             t.completed_at,
             t.start_date,
             t.billable,
             t.schedule_id,
             t.end_date,
             t.due_time ${passThroughColumns}
      FROM base t
      LEFT JOIN projects pj ON pj.id = t.project_id
      LEFT JOIN tasks pt ON pt.id = t.parent_task_id
      LEFT JOIN task_statuses pts ON pts.id = pt.status_id
      LEFT JOIN task_priorities ptp ON ptp.id = pt.priority_id
      LEFT JOIN task_statuses ts ON ts.id = t.status_id
      LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
      LEFT JOIN task_priorities tp ON tp.id = t.priority_id
      LEFT JOIN users ru ON ru.id = t.reporter_id
      LEFT JOIN comments_agg cma ON cma.task_id = t.id
      LEFT JOIN attachments_agg ata ON ata.task_id = t.id
      LEFT JOIN latest_comment_agg lc ON lc.task_id = t.id
      LEFT JOIN worklog_agg wla ON wla.task_id = t.id
      LEFT JOIN subscribers_agg sub ON sub.task_id = t.id
      LEFT JOIN dependencies_agg dep ON dep.task_id = t.id
      LEFT JOIN timers_agg tmr ON tmr.task_id = t.id
      LEFT JOIN completed_children_agg cca ON cca.parent_task_id = t.id
      LEFT JOIN LATERAL (
        SELECT phase_id FROM task_phase WHERE task_id = t.id LIMIT 1
      ) tph ON TRUE
      LEFT JOIN project_phases pph ON pph.id = tph.phase_id
      LEFT JOIN assignees_agg asg ON asg.task_id = t.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(JSON_AGG(rec), '[]'::JSON) AS labels
        FROM (SELECT tl.label_id AS id, tml.name, tml.color_code
              FROM task_labels tl
              LEFT JOIN team_labels tml ON tml.id = tl.label_id
              WHERE tl.task_id = t.id) rec
      ) lbl ON TRUE
      ORDER BY t.sort_rank
    `;

    return { query: q, params: queryParams, isSubTasks };
  }

  public static async getGroups(
    groupBy: string,
    projectId: string
  ): Promise<ITaskGroup[]> {
    let q = "";
    let params: any[] = [];
    switch (groupBy) {
      case GroupBy.STATUS:
        q = `
          SELECT id,
                 name,
                COALESCE(task_statuses.color_code,
                   (SELECT color_code FROM sys_task_status_categories WHERE id = task_statuses.category_id)
                 ) AS color_code,
                 COALESCE(task_statuses.color_code,
                   (SELECT color_code_dark FROM sys_task_status_categories WHERE id = task_statuses.category_id),
                   (SELECT color_code FROM sys_task_status_categories WHERE id = task_statuses.category_id)
                 ) AS color_code_dark,
                 category_id
                 category_id
          FROM task_statuses
          WHERE project_id = $1
          ORDER BY sort_order;
        `;
        params = [projectId];
        break;
      case GroupBy.PRIORITY:
        q = `SELECT id, name, color_code, color_code_dark
             FROM task_priorities
             ORDER BY value DESC;`;
        break;
      case GroupBy.LABELS:
        q = `
          SELECT id, name, color_code
          FROM team_labels
          WHERE team_id = $2
            AND EXISTS(SELECT 1
                       FROM tasks
                       WHERE project_id = $1
                         AND EXISTS(SELECT 1 FROM task_labels WHERE task_id = tasks.id AND label_id = team_labels.id))
          ORDER BY name;
        `;
        break;
      case GroupBy.PHASE:
        q = `
          SELECT id, name, color_code, color_code AS color_code_dark, start_date, end_date, sort_index
          FROM project_phases
          WHERE project_id = $1
          ORDER BY sort_index DESC;
        `;
        params = [projectId];
        break;

      default:
        break;
    }

    if (!q) return [];

    const result = await db.query(q, params);
    return result.rows;
  }

  @HandleExceptions()
  public static async getList(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const startTime = performance.now();

    // PERFORMANCE OPTIMIZATION: Skip expensive progress calculation by default
    // Progress values are already calculated and stored in the database
    // Only refresh if explicitly requested via refresh_progress=true query parameter
    if (req.query.refresh_progress === "true" && req.params.id) {
      const progressStartTime = performance.now();
      await this.refreshProjectTaskProgressValues(req.params.id);
      const progressEndTime = performance.now();
    }

    const groupBy = (req.query.group || GroupBy.STATUS) as string;

    // Add customColumns flag to query params
    req.query.customColumns = "true";

    const assigneeScope = await resolveAssigneeTaskScope(
      req.user?.id,
      req.params.id,
      req.user
    );
    const { query: q, params, isSubTasks } = TasksControllerV2.getQuery(
      req.user?.id as string,
      req.query,
      req.params.id,
      assigneeScope
    );

    const result = await db.query(q, params);
    const tasks = [...result.rows];

    const groups = await this.getGroups(groupBy, req.params.id);
    const map = groups.reduce((g: { [x: string]: ITaskGroup }, group) => {
      if (group.id) g[group.id] = new TaskListGroup(group);
      return g;
    }, {});

    await this.updateMapByGroup(tasks, groupBy, map);

    const updatedGroups = Object.keys(map).map((key) => {
      const group = map[key];

      TasksControllerV2.updateTaskProgresses(group);

      // if (groupBy === GroupBy.PHASE)
      //   group.color_code = group.color_code + TASK_PRIORITY_COLOR_ALPHA;

      return {
        id: key,
        ...group,
      };
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Log warning if this deprecated method is taking too long
    if (totalTime > 1000) {
      log_error(
        `[PERFORMANCE WARNING] DEPRECATED getList method taking ${totalTime.toFixed(
          2
        )}ms - Frontend should use getTasksV3 instead!`
      );
    }

    return res.status(200).send(new ServerResponse(true, updatedGroups));
  }

  public static async updateMapByGroup(
    tasks: any[],
    groupBy: string,
    map: { [p: string]: ITaskGroup }
  ) {
    let index = 0;
    const unmapped = [];

    // PERFORMANCE OPTIMIZATION: Remove expensive individual DB calls for each task
    // Progress values are already calculated and included in the main query
    // No need to make additional database calls here

    // Process tasks with their already-calculated progress values
    for (const task of tasks) {
      task.index = index++;
      TasksControllerV2.updateTaskViewModel(task);

      if (groupBy === GroupBy.STATUS) {
        map[task.status]?.tasks.push(task);
      } else if (groupBy === GroupBy.PRIORITY) {
        map[task.priority]?.tasks.push(task);
      } else if (groupBy === GroupBy.PHASE && task.phase_id) {
        map[task.phase_id]?.tasks.push(task);
      } else {
        unmapped.push(task);
      }
    }

    if (unmapped.length) {
      map[UNMAPPED] = {
        name: UNMAPPED,
        category_id: null,
        color_code: "#fbc84c69",
        color_code_dark: "#fbc84c69",
        tasks: unmapped,
      };
    }
  }

  public static updateTaskProgresses(group: ITaskGroup) {
    const todoCount = group.tasks.filter(
      (t) => t.status_category?.is_todo
    ).length;
    const doingCount = group.tasks.filter(
      (t) => t.status_category?.is_doing
    ).length;
    const doneCount = group.tasks.filter(
      (t) => t.status_category?.is_done
    ).length;

    const total = group.tasks.length;

    group.todo_progress = +this.calculateTaskCompleteRatio(todoCount, total);
    group.doing_progress = +this.calculateTaskCompleteRatio(doingCount, total);
    group.done_progress = +this.calculateTaskCompleteRatio(doneCount, total);
  }

  @HandleExceptions()
  public static async getTasksOnly(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const startTime = performance.now();

    if (req.query.refresh_progress === "true" && req.params.id) {
      await this.refreshProjectTaskProgressValues(req.params.id);
    }

    const isSubTasks = !!req.query.parent_task;

    // Add customColumns flag to query params
    req.query.customColumns = "true";

    const assigneeScope = await resolveAssigneeTaskScope(
      req.user?.id,
      req.params.id,
      req.user
    );
    const { query: q, params } = TasksControllerV2.getQuery(
      req.user?.id as string,
      req.query,
      req.params.id,
      assigneeScope
    );
    const result = await db.query(q, params);

    let data: any[] = [];

    // if true, we only return the record count
    if (this.isCountsOnly(req.query)) {
      [data] = result.rows;
    } else {
      // else we return a flat list of tasks
      data = [...result.rows];

      // PERFORMANCE OPTIMIZATION: Remove expensive individual DB calls for each task
      // Progress values are already calculated and included in the main query via get_task_complete_ratio
      // The database query already includes complete_ratio, so no need for additional calls

      for (const task of data) {
        TasksControllerV2.updateTaskViewModel(task);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    if (totalTime > 1000) {
      log_error(
        `[PERFORMANCE WARNING] getTasksOnly method taking ${totalTime.toFixed(
          2
        )}ms - Consider using getTasksV3 for better performance!`
      );
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async convertToTask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE tasks
      SET parent_task_id = NULL,
          sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0)
      WHERE id = $1;
    `;
    await db.query(q, [req.body.id, req.body.project_id]);

    const result = await db.query("SELECT get_single_task($1) AS task;", [
      req.body.id,
    ]);
    const [data] = result.rows;
    const model = TasksControllerV2.updateTaskViewModel(data.task);
    return res.status(200).send(new ServerResponse(true, model));
  }

  @HandleExceptions()
  public static async getNewKanbanTask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const result = await db.query("SELECT get_single_task($1) AS task;", [id]);
    const [data] = result.rows;
    const task = TasksControllerV2.updateTaskViewModel(data.task);
    return res.status(200).send(new ServerResponse(true, task));
  }

  @HandleExceptions()
  public static async resetParentTaskManualProgress(
    parentTaskId: string
  ): Promise<void> {
    try {
      // Check if this task has subtasks
      const subTasksResult = await db.query(
        "SELECT COUNT(*) as subtask_count FROM tasks WHERE parent_task_id = $1 AND archived IS FALSE",
        [parentTaskId]
      );

      const subtaskCount = parseInt(
        subTasksResult.rows[0]?.subtask_count || "0"
      );

      // If it has subtasks, reset the manual_progress flag to false
      if (subtaskCount > 0) {
        await db.query(
          "UPDATE tasks SET manual_progress = false WHERE id = $1",
          [parentTaskId]
        );

        // Get the project settings to determine which calculation method to use
        const projectResult = await db.query(
          "SELECT project_id FROM tasks WHERE id = $1",
          [parentTaskId]
        );

        const projectId = projectResult.rows[0]?.project_id;

        if (projectId) {
          // Recalculate the parent task's progress based on its subtasks
          const progressResult = await db.query(
            "SELECT get_task_complete_ratio($1) AS ratio",
            [parentTaskId]
          );

          const progressRatio = progressResult.rows[0]?.ratio?.ratio || 0;

          // Emit the updated progress value to all clients
          // Note: We don't have socket context here, so we can't directly emit
          // This will be picked up on the next client refresh
        }
      }
    } catch (error) {
      log_error(`Error resetting parent task manual progress: ${error}`);
    }
  }

  @HandleExceptions()
  public static async convertToSubtask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const groupType = req.body.group_by;
    let q = ``;

    if (groupType == "status") {
      q = `
        UPDATE tasks
        SET parent_task_id = $3,
            sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0),
            status_id      = $4
        WHERE id = $1;
      `;
    } else if (groupType == "priority") {
      q = `
        UPDATE tasks
        SET parent_task_id = $3,
            sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0),
            priority_id    = $4
        WHERE id = $1;
      `;
    } else if (groupType === "phase") {
      await db.query(
        `
        UPDATE tasks
        SET parent_task_id = $3,
            sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0)
        WHERE id = $1;
      `,
        [req.body.id, req.body.project_id, req.body.parent_task_id]
      );
      q = `SELECT handle_on_task_phase_change($1, $2);`;
    }

    if (req.body.to_group_id === UNMAPPED) req.body.to_group_id = null;

    const params =
      groupType === "phase"
        ? [req.body.id, req.body.to_group_id]
        : [
          req.body.id,
          req.body.project_id,
          req.body.parent_task_id,
          req.body.to_group_id,
        ];
    await db.query(q, params);

    // Reset the parent task's manual progress when converting a task to a subtask
    if (req.body.parent_task_id) {
      await this.resetParentTaskManualProgress(req.body.parent_task_id);
    }

    const result = await db.query("SELECT get_single_task($1) AS task;", [
      req.body.id,
    ]);
    const [data] = result.rows;
    const model = TasksControllerV2.updateTaskViewModel(data.task);
    return res.status(200).send(new ServerResponse(true, model));
  }

  public static async getTaskSubscribers(taskId: string) {
    const q = `
      SELECT u.name, u.avatar_url, ts.user_id, ts.team_member_id, ts.task_id
      FROM task_subscribers ts
             LEFT JOIN users u ON ts.user_id = u.id
      WHERE ts.task_id = $1;
    `;
    const result = await db.query(q, [taskId]);

    for (const member of result.rows) member.color_code = getColor(member.name);

    return this.createTagList(result.rows);
  }

  public static async getProjectSubscribers(projectId: string) {
    const q = `
      SELECT u.name, u.avatar_url, ps.user_id, ps.team_member_id, ps.project_id
      FROM project_subscribers ps
             LEFT JOIN users u ON ps.user_id = u.id
      WHERE ps.project_id = $1;
    `;
    const result = await db.query(q, [projectId]);

    for (const member of result.rows) member.color_code = getColor(member.name);

    return this.createTagList(result.rows);
  }

  public static async checkUserAssignedToTask(
    taskId: string,
    userId: string,
    teamId: string
  ) {
    const q = `
    SELECT EXISTS(
        SELECT * FROM tasks_assignees WHERE task_id = $1 AND team_member_id = (SELECT team_member_id FROM team_member_info_view WHERE user_id = $2 AND team_id = $3)
    );
    `;
    const result = await db.query(q, [taskId, userId, teamId]);
    const [data] = result.rows;

    return data.exists;
  }

  public static async getTasksByName(
    searchString: string,
    projectId: string,
    taskId: string,
    assigneeScope?: AssigneeTaskScope
  ) {
    const queryParams: unknown[] = [`%${searchString}%`, projectId, taskId];
    const scopeFilter = buildAssigneeScopeFilter(
      assigneeScope || { applyFilter: false, teamMemberId: null },
      "t.id",
      4
    );
    if (scopeFilter.params.length > 0) {
      queryParams.push(...scopeFilter.params);
    }

    const q = `SELECT id AS value ,
       name AS label,
       CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no) AS task_key
      FROM tasks t
      WHERE t.name ILIKE $1
        AND t.project_id = $2 AND t.id != $3
        ${scopeFilter.clause ? `AND ${scopeFilter.clause}` : ""}
      LIMIT 15;`;
    const result = await db.query(q, queryParams);

    return result.rows;
  }

  @HandleExceptions()
  public static async getSubscribers(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const subscribers = await this.getTaskSubscribers(req.params.id);
    return res.status(200).send(new ServerResponse(true, subscribers));
  }

  @HandleExceptions()
  public static async searchTasks(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId, taskId, searchQuery } = req.query;
    const assigneeScope = await resolveAssigneeTaskScope(
      req.user?.id,
      projectId as string,
      req.user
    );
    const tasks = await this.getTasksByName(
      searchQuery as string,
      projectId as string,
      taskId as string,
      assigneeScope
    );
    return res.status(200).send(new ServerResponse(true, tasks));
  }

  @HandleExceptions()
  public static async getTaskDependencyStatus(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { statusId, taskId } = req.query;
    const canContinue = await TasksControllerV2.checkForCompletedDependencies(
      taskId as string,
      statusId as string
    );
    return res
      .status(200)
      .send(new ServerResponse(true, { can_continue: canContinue }));
  }

  @HandleExceptions()
  public static async checkForCompletedDependencies(
    taskId: string,
    nextStatusId: string
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT
    CASE
        WHEN EXISTS (
            -- Check if the status id is not in the "done" category
            SELECT 1
            FROM task_statuses ts
            WHERE ts.id = $2
              AND ts.project_id = (SELECT project_id FROM tasks WHERE id = $1)
              AND ts.category_id IN (
                  SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE
              )
        ) THEN TRUE -- If status is not in the "done" category, continue immediately (TRUE)

        WHEN EXISTS (
            -- Check if any direct dependent tasks are not completed
            SELECT 1
            FROM task_dependencies td
            LEFT JOIN public.tasks t ON t.id = td.related_task_id
            WHERE td.task_id = $1
              AND t.status_id NOT IN (
                  SELECT id
                  FROM task_statuses ts
                  WHERE t.project_id = ts.project_id
                    AND ts.category_id IN (
                        SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE
                    )
              )
        ) THEN FALSE -- If there are incomplete dependent tasks, do not continue (FALSE)

        WHEN EXISTS (
            -- Check if any subtask dependencies (at any nesting level) are not completed
            -- Uses recursive CTE to find all descendants (subtasks, nested subtasks, etc.)
            WITH RECURSIVE task_descendants AS (
                -- Base case: direct children (subtasks)
                SELECT id, parent_task_id
                FROM tasks
                WHERE parent_task_id = $1 AND archived IS FALSE
                
                UNION ALL
                
                -- Recursive case: children of children (nested subtasks at any level)
                SELECT child.id, child.parent_task_id
                FROM tasks child
                INNER JOIN task_descendants td ON child.parent_task_id = td.id
                WHERE child.archived IS FALSE
            )
            SELECT 1
            FROM task_descendants subtask
            INNER JOIN task_dependencies dep ON dep.task_id = subtask.id
            LEFT JOIN public.tasks dep_task ON dep_task.id = dep.related_task_id
            WHERE dep_task.status_id NOT IN (
                SELECT id
                FROM task_statuses ts
                WHERE dep_task.project_id = ts.project_id
                  AND ts.category_id IN (
                      SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE
                  )
            )
        ) THEN FALSE -- If there are incomplete subtask dependencies at any level, do not continue (FALSE)

        ELSE TRUE -- Continue if no other conditions block the process
    END AS can_continue;`;
    const result = await db.query(q, [taskId, nextStatusId]);
    const [data] = result.rows;

    return data.can_continue;
  }

  public static async getTaskStatusColor(status_id: string) {
    try {
      const q = `SELECT COALESCE(s.color_code, c.color_code)                       AS color_code,
                        COALESCE(s.color_code, c.color_code_dark, c.color_code) AS color_code_dark
                 FROM task_statuses s
                        INNER JOIN sys_task_status_categories c ON c.id = s.category_id
                 WHERE s.id = $1`;
      const result = await db.query(q, [status_id]);
      const [data] = result.rows;
      return data;
    } catch (e) {
      log_error(e);
    }
  }

  @HandleExceptions()
  public static async assignLabelsToTask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { labels }: { labels: string[] } = req.body;

    const q = `SELECT replace_task_labels($1, $2) AS labels;`;
    const result = await db.query(q, [id, labels]);

    return res
      .status(200)
      .send(
        new ServerResponse(
          true,
          result.rows[0]?.labels || [],
          "Labels assigned successfully"
        )
      );
  }

  /**
   * Updates a custom column value for a task
   * @param req The request object
   * @param res The response object
   */
  @HandleExceptions()
  public static async updateCustomColumnValue(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { taskId } = req.params;
    const { column_key, value } = req.body;

    if (!taskId || !column_key || value === undefined) {
      return res
        .status(400)
        .send(new ServerResponse(false, "Missing required parameters"));
    }

    // Resolve the task's actual project rather than trusting a client-supplied
    // project_id, which can go stale (e.g. after the task moves projects).
    const taskProjectResult = await db.query(
      `SELECT project_id FROM tasks WHERE id = $1 LIMIT 1`,
      [taskId]
    );
    if (taskProjectResult.rowCount === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Task not found"));
    }
    const project_id = taskProjectResult.rows[0].project_id;

    // Get column information
    const columnQuery = `
      SELECT id, field_type
      FROM cc_custom_columns
      WHERE project_id = $1 AND key = $2
    `;
    const columnResult = await db.query(columnQuery, [project_id, column_key]);

    if (columnResult.rowCount === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, "Custom column not found"));
    }

    const column = columnResult.rows[0];
    const columnId = column.id;
    const fieldType = column.field_type;

    const normalizedPeopleValue =
      fieldType === "people" ? normalizePeopleCustomColumnValue(value) : null;

    const isEmptyValue =
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (fieldType === "people" && normalizedPeopleValue !== null && normalizedPeopleValue.length === 0);

    if (isEmptyValue) {
      await db.query(
        `
          DELETE FROM cc_column_values
          WHERE task_id = $1 AND column_id = $2
        `,
        [taskId, columnId]
      );

      return res.status(200).send(
        new ServerResponse(true, {
          task_id: taskId,
          column_key,
          value: null,
        })
      );
    }

    // Determine which value field to use based on the field_type
    let textValue = null;
    let numberValue = null;
    let dateValue = null;
    let booleanValue = null;
    let jsonValue = null;

    switch (fieldType) {
      case "text":
        textValue = String(value);
        break;
      case "number":
        numberValue = parseFloat(String(value));
        break;
      case "date":
        dateValue = new Date(String(value));
        break;
      case "checkbox":
        booleanValue = Boolean(value);
        break;
      case "people":
        jsonValue = JSON.stringify(normalizedPeopleValue || []);
        break;
      default:
        textValue = String(value);
    }

    // Check if a value already exists
    const existingValueQuery = `
      SELECT id
      FROM cc_column_values
      WHERE task_id = $1 AND column_id = $2
    `;
    const existingValueResult = await db.query(existingValueQuery, [
      taskId,
      columnId,
    ]);

    if (existingValueResult.rowCount && existingValueResult.rowCount > 0) {
      // Update existing value
      const updateQuery = `
        UPDATE cc_column_values
        SET text_value = $1,
            number_value = $2,
            date_value = $3,
            boolean_value = $4,
            json_value = $5,
            updated_at = NOW()
        WHERE task_id = $6 AND column_id = $7
      `;
      await db.query(updateQuery, [
        textValue,
        numberValue,
        dateValue,
        booleanValue,
        jsonValue,
        taskId,
        columnId,
      ]);
    } else {
      // Insert new value
      const insertQuery = `
        INSERT INTO cc_column_values
        (task_id, column_id, text_value, number_value, date_value, boolean_value, json_value, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `;
      await db.query(insertQuery, [
        taskId,
        columnId,
        textValue,
        numberValue,
        dateValue,
        booleanValue,
        jsonValue,
      ]);
    }

    return res.status(200).send(
      new ServerResponse(true, {
        task_id: taskId,
        column_key,
        value,
      })
    );
  }

  public static async refreshProjectTaskProgressValues(
    projectId: string
  ): Promise<void> {
    try {
      // Run the recalculate_all_task_progress function only for tasks in this project
      const query = `
      DO $$
      DECLARE
        v_project_id UUID := $1;
      BEGIN
        -- First, reset manual_progress flag for all tasks that have subtasks within this project
        UPDATE tasks AS t
        SET manual_progress = FALSE
        WHERE project_id = v_project_id
        AND EXISTS (
            SELECT 1
            FROM tasks
            WHERE parent_task_id = t.id
            AND archived IS FALSE
        );

        -- Start recalculation from leaf tasks (no subtasks) and propagate upward
        -- This ensures calculations are done in the right order
        WITH RECURSIVE task_hierarchy AS (
            -- Base case: Start with all leaf tasks (no subtasks) in this project
            SELECT
                id,
                parent_task_id,
                0 AS level
            FROM tasks
            WHERE project_id = v_project_id
            AND NOT EXISTS (
                SELECT 1 FROM tasks AS sub
                WHERE sub.parent_task_id = tasks.id
                AND sub.archived IS FALSE
            )
            AND archived IS FALSE

            UNION ALL

            -- Recursive case: Move up to parent tasks, but only after processing all their children
            SELECT
                t.id,
                t.parent_task_id,
                th.level + 1
            FROM tasks t
            JOIN task_hierarchy th ON t.id = th.parent_task_id
            WHERE t.archived IS FALSE
        )
        -- Sort by level to ensure we calculate in the right order (leaves first, then parents)
        UPDATE tasks
        SET progress_value = (SELECT (get_task_complete_ratio(tasks.id)->>'ratio')::FLOAT)
        FROM (
            SELECT id, level
            FROM task_hierarchy
            ORDER BY level
        ) AS ordered_tasks
        WHERE tasks.id = ordered_tasks.id
        AND tasks.project_id = v_project_id
        AND (manual_progress IS FALSE OR manual_progress IS NULL);
      END $$;
      `;

      await db.query(query, [projectId]);
    } catch (error) {
      log_error("Error refreshing project task progress values", error);
    }
  }

  public static async updateTaskProgress(taskId: string): Promise<void> {
    try {
      // Calculate the task's progress using get_task_complete_ratio
      const result = await db.query(
        "SELECT get_task_complete_ratio($1) AS info;",
        [taskId]
      );
      const [data] = result.rows;

      if (data && data.info && data.info.ratio !== undefined) {
        const progressValue = +(data.info.ratio || 0).toFixed();

        // Update the task's progress_value in the database
        await db.query("UPDATE tasks SET progress_value = $1 WHERE id = $2", [
          progressValue,
          taskId,
        ]);

        // If this task has a parent, update the parent's progress as well
        const parentResult = await db.query(
          "SELECT parent_task_id FROM tasks WHERE id = $1",
          [taskId]
        );

        if (
          parentResult.rows.length > 0 &&
          parentResult.rows[0].parent_task_id
        ) {
          await this.updateTaskProgress(parentResult.rows[0].parent_task_id);
        }
      }
    } catch (error) {
      log_error(`Error updating task progress: ${error}`);
    }
  }

  // Add this method to update progress when a task's weight is changed
  public static async updateTaskWeight(
    taskId: string,
    weight: number
  ): Promise<void> {
    try {
      // Update the task's weight
      await db.query("UPDATE tasks SET weight = $1 WHERE id = $2", [
        weight,
        taskId,
      ]);

      // Get the parent task ID
      const parentResult = await db.query(
        "SELECT parent_task_id FROM tasks WHERE id = $1",
        [taskId]
      );

      // If this task has a parent, update the parent's progress
      if (parentResult.rows.length > 0 && parentResult.rows[0].parent_task_id) {
        await this.updateTaskProgress(parentResult.rows[0].parent_task_id);
      }
    } catch (error) {
      log_error(`Error updating task weight: ${error}`);
    }
  }

  @HandleExceptions()
  public static async getTasksV3(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const startTime = performance.now();
    const groupBy = (req.query.group || GroupBy.STATUS) as string;

    // PERFORMANCE OPTIMIZATION: Skip expensive progress calculation by default
    // Progress values are already calculated and stored in the database
    // Only refresh if explicitly requested via refresh_progress=true query parameter
    // This dramatically improves initial load performance (from ~2-5s to ~200-500ms)
    const shouldRefreshProgress = req.query.refresh_progress === "true";

    if (shouldRefreshProgress && req.params.id) {
      await this.refreshProjectTaskProgressValues(req.params.id);
    }

    const assigneeScope = await resolveAssigneeTaskScope(
      req.user?.id,
      req.params.id,
      req.user
    );
    const { query: q, params, isSubTasks } = TasksControllerV2.getQuery(
      req.user?.id as string,
      req.query,
      req.params.id,
      assigneeScope
    );
    const result = await db.query(q, params);
    const tasks = [...result.rows];

    // Get groups metadata dynamically from database
    const groups = await this.getGroups(groupBy, req.params.id);

    // Create priority value to name mapping
    const priorityMap: Record<string, string> = {
      "0": "low",
      "1": "medium",
      "2": "high",
      "3": "critical",
    };

    // Create status category mapping based on actual status names from database
    const statusCategoryMap: Record<string, string> = {};
    for (const group of groups) {
      if (groupBy === GroupBy.STATUS && group.id) {
        // Use the actual status name from database, convert to lowercase for consistency
        statusCategoryMap[group.id] = group.name
          .toLowerCase()
          .replace(/\s+/g, "_");
      }
    }

    // Transform tasks with all necessary data preprocessing
    const transformedTasks = tasks.map((task, index) => {
      // Update task with calculated values (lightweight version)
      TasksControllerV2.updateTaskViewModel(task);
      task.index = index;

      // Convert time values to hours
      const convertToHours = (
        value: any,
        isSeconds: boolean = false
      ): number => {
        if (typeof value === "number") {
          return isSeconds ? value / 3600 : value / 60; // Convert seconds or minutes to hours
        }
        if (typeof value === "string") {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : isSeconds ? parsed / 3600 : parsed / 60;
        }
        if (value && typeof value === "object") {
          if ("hours" in value || "minutes" in value) {
            const hours = Number(value.hours || 0);
            const minutes = Number(value.minutes || 0);
            return hours + minutes / 60;
          }
        }
        return 0;
      };

      const calculatedProgress =
        typeof task.complete_ratio === "number" ? task.complete_ratio : 0;

      return {
        id: task.id,
        task_key: task.task_key || "",
        title: task.name || "",
        name: task.name || "",
        description: task.description || "",
        // Use dynamic status mapping from database
        status: statusCategoryMap[task.status] || task.status,
        // Pre-processed priority using mapping
        priority: priorityMap[task.priority_value?.toString()] || "medium",
        // Use actual phase name from database
        phase: task.phase_name || "Development",
        epic_id: task.epic_id || null,
        story_points: task.story_points ?? null,
        is_blocked: task.is_blocked === true,
        issue_type: task.issue_type || "task",
        progress: calculatedProgress,
        complete_ratio: task.complete_ratio, // Also include original field
        progress_value: task.progress_value, // Also include original field
        assignees: task.assignees?.map((a: any) => a.team_member_id) || [],
        assignee_names: task.assignee_names || task.names || [],
        labels:
          task.labels?.map((l: any) => ({
            id: l.id || l.label_id,
            name: l.name,
            color: l.color_code || "#1890ff",
            end: l.end,
            names: l.names,
          })) || [],
        all_labels: task.all_labels || [],
        dueDate: task.end_date || task.END_DATE,
        startDate: task.start_date,
        due_time: task.due_time ? String(task.due_time).substring(0, 5) : null,
        completed_at: task.completed_at || undefined,
        timeTracking: {
          estimated: convertToHours(task.total_minutes, false), // total_minutes is in minutes
          logged: convertToHours(task.total_minutes_spent, true), // total_minutes_spent is in seconds
        },
        customFields: {},
        custom_column_values: task.custom_column_values || {}, // Include custom column values
        createdAt: task.created_at || new Date().toISOString(),
        updatedAt: task.updated_at || new Date().toISOString(),
        order: TasksControllerV2.getTaskSortOrder(task, groupBy),
        // Additional metadata for frontend
        originalStatusId: task.status,
        originalPriorityId: task.priority,
        statusColor: task.status_color,
        priorityColor: task.priority_color,
        // Add subtask count
        sub_tasks_count: task.sub_tasks_count || 0,
        sub_tasks: task.sub_tasks || [],
        show_sub_tasks: !!task.show_sub_tasks,
        is_sub_task: !!task.is_sub_task,
        parent_task_id: task.parent_task_id || null,
        parent_task_name: task.parent_task_name || null,
        parent_task_key: task.parent_task_key || null,
        parent_task_archived: task.parent_task_archived ?? null,
        parent_task_status_id: task.parent_task_status_id || null,
        parent_task_status_name: task.parent_task_status_name || null,
        parent_task_priority_id: task.parent_task_priority_id || null,
        parent_task_priority_value: task.parent_task_priority_value ?? null,
        parent_task_priority_color: task.parent_task_priority_color || null,
        parent_is_subtask: !!task.parent_is_subtask,
        // TVR-13: parent shown for context when member is assigned only to a subtask
        assignee_scope_readonly: !!task.assignee_scope_readonly,
        // Add flag for auto-expansion when filters match descendants
        has_filtered_children: !!task.has_filtered_children,
        // Add indicator fields for frontend icons
        comments_count: task.comments_count || 0,
        has_subscribers: !!task.has_subscribers,
        attachments_count: task.attachments_count || 0,
        attachments: (task.attachments || []).map((attachment: any) => ({
          ...attachment,
          size: humanFileSize(Number(attachment.size || 0)),
        })),
        latest_comment: task.latest_comment || null,
        latest_comment_at: task.latest_comment_at || null,
        latest_comment_author: task.latest_comment_author || null,
        has_dependencies: !!task.has_dependencies,
        schedule_id: task.schedule_id || null,
        reporter: task.reporter || null,
      };
    });

    const isArchivedMode = req.query.archived === "true";
    if (isArchivedMode && !isSubTasks) {
      const subTasksByParent = new Map<string, any[]>();
      const topLevelTasks: any[] = [];
      // Track all real task IDs present in the archived payload (top-level + nested).
      // This prevents creating duplicate synthetic parent containers when a real parent
      // task exists but is not a top-level row.
      const existingRealTaskIds = new Set<string>();

      for (const task of transformedTasks) {
        if (task.id) {
          existingRealTaskIds.add(String(task.id));
        }
        if (task.parent_task_id) {
          const parentId = String(task.parent_task_id);
          const list = subTasksByParent.get(parentId) || [];
          list.push(task);
          subTasksByParent.set(parentId, list);
        } else {
          topLevelTasks.push(task);
        }
      }

      for (const [parentId, subtasks] of subTasksByParent.entries()) {
        subtasks.sort((a, b) => (a.order || 0) - (b.order || 0));

        const existingParent = topLevelTasks.find((task) => String(task.id) === parentId);
        if (existingParent) {
          existingParent.show_sub_tasks = true;
          existingParent.sub_tasks = subtasks;
          existingParent.sub_tasks_count = subtasks.length;
          continue;
        }

        // Parent exists in the archived dataset as a real task (likely nested under another
        // archived parent). Skip synthetic container to avoid duplicated standalone rows.
        if (existingRealTaskIds.has(parentId)) {
          continue;
        }

        const [firstSubtask] = subtasks;
        
        // Fetch the real parent task's progress value from database
        const parentTaskQuery = `
          SELECT 
            progress_value,
            COALESCE(progress_value, 0) AS complete_ratio,
            (SELECT is_completed(status_id, project_id)) AS is_complete
          FROM tasks
          WHERE id = $1
        `;
        const parentTaskResult = await db.query(parentTaskQuery, [parentId]);
        const realParentData = parentTaskResult.rows[0];
        
        // Calculate the actual progress value for the synthetic parent
        // Use the real parent task's progress from database
        let parentProgress = 0;
        let parentCompleteRatio = 0;
        let parentProgressValue = 0;
        
        if (realParentData) {
          // If parent task is marked as complete, show 100%
          if (realParentData.is_complete) {
            parentProgress = 100;
            parentCompleteRatio = 100;
            parentProgressValue = 100;
          } else {
            // Otherwise use the calculated progress value from database
            parentProgress = realParentData.progress_value || 0;
            parentCompleteRatio = realParentData.complete_ratio || 0;
            parentProgressValue = realParentData.progress_value || 0;
          }
        }
        
        const syntheticParent = {
          ...firstSubtask,
          id: `archived-parent-container-${parentId}`,
          parent_task_container_id: parentId,
          task_key: firstSubtask.parent_task_key || firstSubtask.task_key || "",
          title: firstSubtask.parent_task_name || "Parent Task",
          name: firstSubtask.parent_task_name || "Parent Task",
          is_sub_task: false,
          archived: false,
          is_parent_container: true,
          parent_task_not_archived: true,
          // Synthetic rows should reflect the real parent task's status when available.
          // Without this override the spread from firstSubtask would carry the subtask's
          // status (e.g. "Doing") onto the parent container row.
          status: firstSubtask.parent_task_status_name
            || (firstSubtask.parent_task_status_id
              ? statusCategoryMap[firstSubtask.parent_task_status_id] || firstSubtask.parent_task_status_id
              : firstSubtask.status),
          // Synthetic rows should reflect the real parent task's priority when available.
          priority:
            priorityMap[firstSubtask.parent_task_priority_value?.toString()] ||
            firstSubtask.priority ||
            "medium",
          originalPriorityId: firstSubtask.parent_task_priority_id || null,
          priorityColor: firstSubtask.parent_task_priority_color || null,
          priority_color: firstSubtask.parent_task_priority_color || null,
          priority_value: firstSubtask.parent_task_priority_value ?? null,
          // CRITICAL FIX: Use the real parent task's actual progress value from database
          // This ensures consistency between archived and non-archived views
          // If parent is "Done", it shows 100%; otherwise shows calculated progress (0 if all subtasks archived)
          progress: parentProgress,
          complete_ratio: parentCompleteRatio,
          progress_value: parentProgressValue,
          show_sub_tasks: true,
          sub_tasks: subtasks,
          sub_tasks_count: subtasks.length,
          order: Math.max((firstSubtask.order || 0) - 0.001, 0),
        };

        topLevelTasks.push(syntheticParent);
      }

      topLevelTasks.sort((a, b) => (a.order || 0) - (b.order || 0));
      transformedTasks.length = 0;
      transformedTasks.push(...topLevelTasks);
    }


    // ── Deduplication: when filters are active, the query returns both parent
    // tasks and their matching subtasks as flat rows.  If a subtask has any
    // ancestor present in the result set we must NOT add it as a standalone
    // top-level row — it will surface nested under its ancestor chain via the
    // sequential fetchSubTasks + has_filtered_children auto-expand.
    //
    // We walk up the full ancestor chain (not just direct parent) to handle
    // deeply nested subtasks correctly.
    //
    // If NO ancestor is present (e.g. grandparent, parent both filtered out but
    // the grandchild matched), the subtask stays flat with a parent breadcrumb.
    const hasActiveFilters = !!(
      req.query.priorities ||
      req.query.labels ||
      req.query.members ||
      req.query.statuses ||
      req.query.phases ||
      req.query.quick_filters
    );
    let filteredTransformedTasks = transformedTasks;
    if (hasActiveFilters && !isSubTasks) {
      const presentTaskIds = new Set(transformedTasks.map((t: any) => t.id));

      // Build a parent_id lookup for O(1) ancestor walks
      const parentIdOf = new Map<string, string>();
      for (const t of transformedTasks) {
        if (t.parent_task_id) parentIdOf.set(t.id, t.parent_task_id);
      }

      const hasAncestorInSet = (taskId: string): boolean => {
        let current = parentIdOf.get(taskId);
        while (current) {
          if (presentTaskIds.has(current)) return true;
          current = parentIdOf.get(current);
        }
        return false;
      };

      filteredTransformedTasks = transformedTasks.filter(
        (task: any) => !task.parent_task_id || !hasAncestorInSet(task.id)
      );
    }

    if (groupBy === GroupBy.ASSIGNEE) {
      return res.status(200).send(
        new ServerResponse(true, {
          groups: TasksControllerV2.buildAssigneeGroups(
            filteredTransformedTasks,
            tasks,
            req.query.include_empty === "true"
          ),
          allTasks: filteredTransformedTasks,
          grouping: groupBy,
          totalTasks: filteredTransformedTasks.length,
          assignee_scope_active: assigneeScope.applyFilter,
        })
      );
    }

    const groupedResponse: Record<string, any> = {};

    // Initialize groups from database data
    groups.forEach((group) => {
      const groupKey =
        groupBy === GroupBy.STATUS
          ? group.name.toLowerCase().replace(/\s+/g, "_")
          : groupBy === GroupBy.PRIORITY
            ? priorityMap[(group as any).value?.toString()] ||
            group.name.toLowerCase()
            : group.name.toLowerCase().replace(/\s+/g, "_");

      groupedResponse[groupKey] = {
        id: group.id,
        title: group.name,
        groupType: groupBy,
        groupValue: groupKey,
        collapsed: false,
        tasks: [],
        taskIds: [],
        color: group.color_code || this.getDefaultGroupColor(groupBy, groupKey),
        color_code_dark:
          group.color_code_dark || this.getDefaultGroupColor(groupBy, groupKey),
        // Include additional metadata from database
        category_id: group.category_id,
        start_date: group.start_date,
        end_date: group.end_date,
        sort_index: (group as any).sort_index,
      };
    });

    // Distribute tasks into groups
    const unmappedTasks: any[] = [];

    filteredTransformedTasks.forEach((task: any) => {
      let groupKey: string;
      let taskAssigned = false;

      if (groupBy === GroupBy.STATUS) {
        groupKey = task.status;
        if (groupedResponse[groupKey]) {
          groupedResponse[groupKey].tasks.push(task);
          groupedResponse[groupKey].taskIds.push(task.id);
          taskAssigned = true;
        }
      } else if (groupBy === GroupBy.PRIORITY) {
        groupKey = task.priority;
        if (groupedResponse[groupKey]) {
          groupedResponse[groupKey].tasks.push(task);
          groupedResponse[groupKey].taskIds.push(task.id);
          taskAssigned = true;
        }
      } else if (groupBy === GroupBy.PHASE) {
        // For phase grouping, check if task has a valid phase
        if (task.phase && task.phase.trim() !== "") {
          groupKey = task.phase.toLowerCase().replace(/\s+/g, "_");
          if (groupedResponse[groupKey]) {
            groupedResponse[groupKey].tasks.push(task);
            groupedResponse[groupKey].taskIds.push(task.id);
            taskAssigned = true;
          }
        }
        // If task doesn't have a valid phase, add to unmapped
        if (!taskAssigned) {
          unmappedTasks.push(task);
        }
      }
    });

    // Calculate progress stats for priority and phase grouping
    if (groupBy === GroupBy.PRIORITY || groupBy === GroupBy.PHASE) {
      Object.values(groupedResponse).forEach((group: any) => {
        if (group.tasks && group.tasks.length > 0) {
          const todoCount = group.tasks.filter((task: any) => {
            // For tasks, we need to check their original status category
            const originalTask = tasks.find((t) => t.id === task.id);
            return originalTask?.status_category?.is_todo;
          }).length;

          const doingCount = group.tasks.filter((task: any) => {
            const originalTask = tasks.find((t) => t.id === task.id);
            return originalTask?.status_category?.is_doing;
          }).length;

          const doneCount = group.tasks.filter((task: any) => {
            const originalTask = tasks.find((t) => t.id === task.id);
            return originalTask?.status_category?.is_done;
          }).length;

          const total = group.tasks.length;

          // Calculate progress percentages
          group.todo_progress =
            total > 0 ? +((todoCount / total) * 100).toFixed(0) : 0;
          group.doing_progress =
            total > 0 ? +((doingCount / total) * 100).toFixed(0) : 0;
          group.done_progress =
            total > 0 ? +((doneCount / total) * 100).toFixed(0) : 0;
        } else {
          // Only set to 0 if there are no tasks
          group.todo_progress = 0;
          group.doing_progress = 0;
          group.done_progress = 0;
        }
      });
    }

    // Create unmapped group if there are tasks without proper phase assignment
    if (unmappedTasks.length > 0 && groupBy === GroupBy.PHASE) {
      const unmappedGroup = {
        id: UNMAPPED,
        title: UNMAPPED,
        groupType: groupBy,
        groupValue: UNMAPPED.toLowerCase(),
        collapsed: false,
        tasks: unmappedTasks,
        taskIds: unmappedTasks.map((task) => task.id),
        color: "#fbc84c69", // Orange color with transparency
        category_id: null,
        start_date: null,
        end_date: null,
        sort_index: 999, // Put unmapped group at the end
        todo_progress: 0,
        doing_progress: 0,
        done_progress: 0,
      };

      // Calculate progress stats for unmapped group
      if (unmappedTasks.length > 0) {
        const todoCount = unmappedTasks.filter((task: any) => {
          const originalTask = tasks.find((t) => t.id === task.id);
          return originalTask?.status_category?.is_todo;
        }).length;

        const doingCount = unmappedTasks.filter((task: any) => {
          const originalTask = tasks.find((t) => t.id === task.id);
          return originalTask?.status_category?.is_doing;
        }).length;

        const doneCount = unmappedTasks.filter((task: any) => {
          const originalTask = tasks.find((t) => t.id === task.id);
          return originalTask?.status_category?.is_done;
        }).length;

        const total = unmappedTasks.length;

        unmappedGroup.todo_progress =
          total > 0 ? +((todoCount / total) * 100).toFixed(0) : 0;
        unmappedGroup.doing_progress =
          total > 0 ? +((doingCount / total) * 100).toFixed(0) : 0;
        unmappedGroup.done_progress =
          total > 0 ? +((doneCount / total) * 100).toFixed(0) : 0;
      }

      groupedResponse[UNMAPPED.toLowerCase()] = unmappedGroup;
    }

    // Sort tasks within each group by order
    Object.values(groupedResponse).forEach((group: any) => {
      group.tasks.sort((a: any, b: any) => a.order - b.order);
    });

    // When a phase filter is active, only include groups matching selected phases
    const selectedPhaseIds = req.query.phases
      ? (req.query.phases as string).split(" ").filter(id => id.trim())
      : [];
    const includeUnmappedGroup =
      selectedPhaseIds.length === 0 ||
      selectedPhaseIds.some(
        id => id === UNMAPPED || id.toLowerCase() === "unmapped"
      );

    // Convert to array format expected by frontend, maintaining database order
    const responseGroups = groups
      .map((group) => {
        const groupKey =
          groupBy === GroupBy.STATUS
            ? group.name.toLowerCase().replace(/\s+/g, "_")
            : groupBy === GroupBy.PRIORITY
              ? priorityMap[(group as any).value?.toString()] ||
              group.name.toLowerCase()
              : group.name.toLowerCase().replace(/\s+/g, "_");

        return groupedResponse[groupKey];
      })
      .filter(
        (group) => {
          if (!group) return false;
          // If a phase filter is active, only show groups whose id is in the selected phases
          if (selectedPhaseIds.length > 0 && groupBy === GroupBy.PHASE) {
            return selectedPhaseIds.includes(group.id);
          }
          return group.tasks.length > 0 || req.query.include_empty === "true";
        }
      );

    // Add unmapped group when not filtered out (or when Unmapped is explicitly selected)
    if (groupedResponse[UNMAPPED.toLowerCase()] && includeUnmappedGroup) {
      if (groupBy === GroupBy.PHASE) {
        responseGroups.push(groupedResponse[UNMAPPED.toLowerCase()]);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Log warning if request is taking too long
    if (totalTime > 1000) {
      log_error(
        `[PERFORMANCE WARNING] Slow request detected: ${totalTime.toFixed(
          2
        )}ms for project ${req.params.id} with ${transformedTasks.length} tasks`
      );
    }

    return res.status(200).send(
      new ServerResponse(true, {
        groups: responseGroups,
        allTasks: filteredTransformedTasks,
        grouping: groupBy,
        totalTasks: filteredTransformedTasks.length,
        assignee_scope_active: assigneeScope.applyFilter,
      })
    );
  }

  /**
   * Groups tasks by assignee. A task with several assignees appears in each of
   * their groups; tasks without assignees go to the Unassigned group (last).
   * Groups are keyed by team_member_id so members sharing a name stay separate.
   */
  private static buildAssigneeGroups(
    transformedTasks: any[],
    rawTasks: any[],
    includeEmpty: boolean
  ): any[] {
    const rawTaskById = new Map<string, any>(rawTasks.map(task => [task.id, task]));
    const groupsById = new Map<string, any>();
    const unassignedTasks: any[] = [];

    const createGroup = (id: string, title: string, avatarUrl: string | null, color: string) => ({
      id,
      title,
      groupType: GroupBy.ASSIGNEE,
      groupValue: id,
      collapsed: false,
      tasks: [] as any[],
      taskIds: [] as string[],
      color,
      color_code_dark: color,
      avatar_url: avatarUrl,
      category_id: null,
      start_date: null,
      end_date: null,
    });

    for (const task of transformedTasks) {
      const assignees: any[] = rawTaskById.get(task.id)?.assignees || [];
      if (assignees.length === 0) {
        unassignedTasks.push(task);
        continue;
      }
      for (const assignee of assignees) {
        const memberId = assignee.team_member_id;
        if (!memberId) continue;
        if (!groupsById.has(memberId)) {
          groupsById.set(
            memberId,
            createGroup(memberId, assignee.name || "", assignee.avatar_url || null, getColor(assignee.name || memberId))
          );
        }
        const group = groupsById.get(memberId);
        group.tasks.push(task);
        group.taskIds.push(task.id);
      }
    }

    const groups = [...groupsById.values()].sort((a, b) => a.title.localeCompare(b.title));

    if (unassignedTasks.length > 0 || includeEmpty) {
      const unassignedGroup = createGroup(UNASSIGNED_GROUP_ID, "Unassigned", null, "#d9d9d9");
      unassignedGroup.tasks = unassignedTasks;
      unassignedGroup.taskIds = unassignedTasks.map(task => task.id);
      groups.push(unassignedGroup);
    }

    for (const group of groups) {
      group.tasks.sort((a: any, b: any) => a.order - b.order);
      const total = group.tasks.length;
      const countByCategory = (category: "is_todo" | "is_doing" | "is_done") =>
        group.tasks.filter((task: any) => rawTaskById.get(task.id)?.status_category?.[category]).length;
      group.todo_progress = total > 0 ? +((countByCategory("is_todo") / total) * 100).toFixed(0) : 0;
      group.doing_progress = total > 0 ? +((countByCategory("is_doing") / total) * 100).toFixed(0) : 0;
      group.done_progress = total > 0 ? +((countByCategory("is_done") / total) * 100).toFixed(0) : 0;
    }

    return groups;
  }

  private static getTaskSortOrder(task: any, groupBy: string): number {
    switch (groupBy) {
      case GroupBy.STATUS:
        return typeof task.status_sort_order === "number"
          ? task.status_sort_order
          : 0;
      case GroupBy.PRIORITY:
        return typeof task.priority_sort_order === "number"
          ? task.priority_sort_order
          : 0;
      case GroupBy.PHASE:
        return typeof task.phase_sort_order === "number"
          ? task.phase_sort_order
          : 0;
      default:
        return typeof task.sort_order === "number" ? task.sort_order : 0;
    }
  }

  private static getDefaultGroupColor(
    groupBy: string,
    groupValue: string
  ): string {
    const colorMaps: Record<string, Record<string, string>> = {
      [GroupBy.STATUS]: {
        todo: "#f0f0f0",
        doing: "#1890ff",
        done: "#52c41a",
      },
      [GroupBy.PRIORITY]: {
        high: "#ff7a45",
        medium: "#faad14",
        low: "#52c41a",
      },
      [GroupBy.PHASE]: {
        unmapped: "#fbc84c69",
      },
    };

    return colorMaps[groupBy]?.[groupValue] || "#d9d9d9";
  }

  @HandleExceptions()
  public static async refreshTaskProgress(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    try {
      const startTime = performance.now();

      if (req.params.id) {
        await this.refreshProjectTaskProgressValues(req.params.id);

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        return res.status(200).send(
          new ServerResponse(true, {
            message: "Task progress values refreshed successfully",
            performanceMetrics: {
              refreshTime: Math.round(totalTime),
              projectId: req.params.id,
            },
          })
        );
      }
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Project ID is required"));
    } catch (error) {
      log_error("Error refreshing task progress:", error);
      return res
        .status(500)
        .send(
          new ServerResponse(false, null, "Failed to refresh task progress")
        );
    }
  }

  // Optimized method for getting task progress without blocking main UI
  @HandleExceptions()
  public static async getTaskProgressStatus(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    try {
      if (!req.params.id) {
        return res
          .status(400)
          .send(new ServerResponse(false, null, "Project ID is required"));
      }

      // Get basic progress stats without expensive calculations
      const result = await db.query(
        `
        SELECT
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN EXISTS(
            SELECT 1 FROM tasks_with_status_view
            WHERE tasks_with_status_view.task_id = tasks.id
            AND is_done IS TRUE
          ) THEN 1 END) as completed_tasks,
          AVG(CASE
            WHEN progress_value IS NOT NULL THEN progress_value
            ELSE 0
          END) as avg_progress,
          MAX(updated_at) as last_updated
        FROM tasks
        WHERE project_id = $1 AND archived IS FALSE
      `,
        [req.params.id]
      );

      const [stats] = result.rows;

      return res.status(200).send(
        new ServerResponse(true, {
          projectId: req.params.id,
          totalTasks: parseInt(stats.total_tasks) || 0,
          completedTasks: parseInt(stats.completed_tasks) || 0,
          avgProgress: parseFloat(stats.avg_progress) || 0,
          lastUpdated: stats.last_updated,
          completionPercentage:
            stats.total_tasks > 0
              ? Math.round(
                (parseInt(stats.completed_tasks) /
                  parseInt(stats.total_tasks)) *
                100
              )
              : 0,
        })
      );
    } catch (error) {
      log_error("Error getting task progress status:", error);
      return res
        .status(500)
        .send(
          new ServerResponse(false, null, "Failed to get task progress status")
        );
    }
  }
}
