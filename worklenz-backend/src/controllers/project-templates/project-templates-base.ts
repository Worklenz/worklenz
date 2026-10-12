import { Socket } from "socket.io";
import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { logStatusChange } from "../../services/activity-logs/activity-logs.service";
import { getColor, int, log_error } from "../../shared/utils";
import { generateProjectKey } from "../../utils/generate-project-key";
import WorklenzControllerBase from "../worklenz-controller-base";
import { IPassportSession } from "../../interfaces/passport-session";
import { actorFromSessionUser, logAuditEvent } from "../../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../../shared/audit-log-constants";
import {
  ICustomProjectTemplate,
  ICustomTemplatePhase,
  IProjectTemplate,
  IProjectTemplateLabel,
  IProjectTemplatePhase,
  IProjectTemplateStatus,
  IProjectTemplateTask,
  ITaskIncludes,
  ICustomColumnWithConfig,
  IColumnConfiguration,
  ISelectionOption,
  ILabelOption,
  IProjectSettingsIncludes,
  IProjectTemplateSettingsSnapshot,
  IProjectTemplateSettingsOverrides,
  ICustomTemplateRateCardRole,
  ICustomTemplateTaskAssignee,
  ICustomTemplateTaskDependency,
  ICustomTemplateTaskRecurrence,
  IProjectTemplateApplySkip,
  IProjectTemplateIncludesPayload,
  CUSTOM_PROJECT_TEMPLATE_SCHEMA_VERSION,
} from "./interfaces";
import {
  applyOffsetDate,
  calendarDayOffset,
  chunkArray,
  mergeProjectSettingsForImport,
  remapTemplateDependencies,
} from "../../shared/project-template-apply-utils";

/** Normalize DB/JSON numeric estimate to a non-negative integer minute count. */
const normalizeTotalMinutes = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

export default abstract class ProjectTemplatesControllerBase extends WorklenzControllerBase {
  // Case-insensitive check for an existing project name within a team, used when
  // importing a project/template so duplicates fail fast instead of relying on
  // create_project()'s own PROJECT_EXISTS_ERROR check further down the pipeline.
  protected static async getCustomTemplateAccess(
    templateId: string,
    teamId: string | null | undefined
  ): Promise<{
    canAccess: boolean;
    canManage: boolean;
    scope: string;
    organizationId: string | null;
  } | null> {
    if (!templateId || !teamId) return null;

    const q = `
      SELECT
        cpt.team_id,
        cpt.scope,
        in_organization(cpt.team_id, $2) AS in_same_organization
      FROM custom_project_templates cpt
      WHERE cpt.id = $1
      LIMIT 1;
    `;
    const result = await db.query(q, [templateId, teamId]);
    if (!result.rowCount) return null;

    const row = result.rows[0];
    const canManage = row.team_id === teamId;
    const isOrganizationShared =
      row.scope === "organization" && row.in_same_organization;
    const canAccess = canManage || isOrganizationShared;

    return {
      canAccess,
      canManage,
      scope: row.scope,
      organizationId: null,
    };
  }

  protected static async findDuplicateProjectName(
    name: string,
    teamId: string | null | undefined
  ): Promise<boolean> {
    const result = await db.query(
      `SELECT id FROM projects WHERE LOWER(name) = LOWER($1) AND team_id = $2 LIMIT 1`,
      [name, teamId]
    );
    return !!result.rowCount && result.rowCount > 0;
  }

  @HandleExceptions()
  protected static async insertProjectTemplate(body: IProjectTemplate) {
    const { name, key, description, phase_label } = body;

    const q = `INSERT INTO pt_project_templates(name, key, description, phase_label) VALUES ($1, $2, $3, $4) RETURNING id;`;
    const result = await db.query(q, [name, key, description, phase_label]);
    const [data] = result.rows;
    return data.id;
  }

  @HandleExceptions()
  protected static async insertTemplateProjectPhases(
    body: IProjectTemplatePhase[],
    template_id: string,
  ) {
    for await (const phase of body) {
      const { name, color_code } = phase;

      const q = `INSERT INTO pt_phases(name, color_code, template_id) VALUES ($1, $2, $3);`;
      await db.query(q, [name, color_code, template_id]);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateProjectStatuses(
    body: IProjectTemplateStatus[],
    template_id: string,
  ) {
    for await (const status of body) {
      const { name, category_name, category_id } = status;

      const q = `INSERT INTO pt_statuses(name, template_id, category_id)
                    VALUES ($1, $2, (SELECT id FROM sys_task_status_categories WHERE sys_task_status_categories.name = $3));`;
      await db.query(q, [name, template_id, category_name]);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateProjectTasks(
    body: IProjectTemplateTask[],
    template_id: string,
  ) {
    for await (const template_task of body) {
      const {
        name,
        description,
        total_minutes,
        sort_order,
        priority_name,
        parent_task_id,
        phase_name,
        status_name,
      } = template_task;

      const q = `INSERT INTO pt_tasks(name, description, total_minutes, sort_order, priority_id, template_id, parent_task_id, status_id)
                    VALUES ($1, $2, $3, $4, (SELECT id FROM task_priorities WHERE task_priorities.name = $5), $6, $7,
                            (SELECT id FROM pt_statuses WHERE pt_statuses.name = $8 AND pt_statuses.template_id = $6)) RETURNING id;`;
      const result = await db.query(q, [
        name,
        description,
        total_minutes,
        sort_order,
        priority_name,
        template_id,
        parent_task_id,
        status_name,
      ]);
      const [task] = result.rows;

      await this.insertTemplateTaskPhases(task.id, template_id, phase_name);
      if (template_task.labels)
        await this.insertTemplateTaskLabels(task.id, template_task.labels);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateTaskPhases(
    task_id: string,
    template_id: string,
    phase_name = "",
  ) {
    const q = `INSERT INTO pt_task_phases (task_id, phase_id) VALUES ($1, (SELECT id FROM pt_phases WHERE template_id = $2 AND name = $3));`;
    await db.query(q, [task_id, template_id, phase_name]);
  }

  @HandleExceptions()
  protected static async insertTemplateTaskLabels(
    task_id: string,
    labels: IProjectTemplateLabel[],
  ) {
    for await (const label of labels) {
      const q = `INSERT INTO pt_task_labels(task_id, label_id) VALUES ($1, (SELECT id FROM pt_labels WHERE name = $2));`;
      await db.query(q, [task_id, label.name]);
    }
  }

  @HandleExceptions()
  protected static async getTemplateData(template_id: string) {
    const q = `SELECT id,
                name,
                description,
                phase_label,
                image_url,
                color_code,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name, color_code FROM pt_phases WHERE template_id = pt.id) rec) AS phases,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name,
                                category_id,
                                (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE sys_task_status_categories.id = pt_statuses.category_id)
                        FROM pt_statuses
                        WHERE template_id = pt.id) rec) AS status,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name, pt_labels.color_code
                            FROM pt_labels
                            WHERE id IN (SELECT label_id
                                        FROM pt_task_labels pttl
                                        WHERE task_id IN (SELECT id
                                                            FROM pt_tasks
                                                            WHERE pt_tasks.template_id = pt.id))) rec) AS labels,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name,
                                color_code
                        FROM task_priorities) rec) AS priorities,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name,
                            (SELECT name FROM pt_statuses WHERE status_id = pt_statuses.id) AS status_name,
                            (SELECT name FROM task_priorities tp WHERE priority_id = tp.id ) AS priority_name,
                            (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT name
                                        FROM pt_phases pl
                                        WHERE pl.id =
                                            (SELECT phase_id FROM pt_task_phases WHERE task_id = pt_tasks.id)) rec) AS phases,
                            (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT name
                                        FROM pt_labels pl
                                                LEFT JOIN pt_task_labels pttl ON pl.id = pttl.label_id
                                        WHERE pttl.task_id = pt_tasks.id) rec) AS labels
                        FROM pt_tasks
                        WHERE template_id = pt.id) rec) AS tasks
                    FROM pt_project_templates pt
                    WHERE id = $1;`;
    const result = await db.query(q, [template_id]);
    const [data] = result.rows;
    if (!data) return null;

    if (!Array.isArray(data.phases)) {
      data.phases = [];
    }

    for (const phase of data.phases) {
      phase.color_code = getColor(phase.name);
    }
    return data;
  }

  @HandleExceptions()
  @HandleExceptions()
  protected static async getCustomTemplateData(template_id: string) {
    // Use recursive CTE to ensure deterministic hierarchical ordering
    // This guarantees parents are always returned before their children
    // and the order is stable across multiple query executions
    const q = `SELECT id,
                        name,
                        notes AS description,
                        phase_label,
                        color_code,
                        schema_version,
                        includes,
                        settings,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT name, color_code FROM cpt_phases WHERE template_id = pt.id) rec) AS phases,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT name,
                                        category_id,
                                        sort_order,
                                        (SELECT color_code
                                        FROM sys_task_status_categories
                                        WHERE sys_task_status_categories.id = cpts.category_id)
                                FROM cpt_task_statuses cpts
                                WHERE template_id = pt.id ORDER BY sort_order) rec) AS status,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT name, tl.color_code
                                FROM team_labels tl
                                WHERE id IN (SELECT label_id
                                            FROM cpt_task_labels ctl
                                            WHERE task_id IN (SELECT id
                                                                FROM cpt_tasks
                                                                WHERE cpt_tasks.template_id = pt.id))) rec) AS labels,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT name,
                                        color_code
                                FROM task_priorities) rec) AS priorities,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                           FROM (
                                WITH RECURSIVE task_tree AS (
                                    -- Base case: root tasks (no parent)
                                    SELECT id, name, parent_task_id, description, total_minutes, 
                                           sort_order, task_no, status_sort_order, priority_sort_order, phase_sort_order,
                                           status_id, priority_id, template_id,
                                           billable, start_offset_days, due_offset_days, task_duration_days,
                                           0 AS depth,
                                           ARRAY[LPAD(sort_order::TEXT, 10, '0'), LPAD(COALESCE(task_no, 0)::TEXT, 10, '0'), id::TEXT] AS path
                                    FROM cpt_tasks
                                    WHERE template_id = pt.id AND parent_task_id IS NULL
                                    
                                    UNION ALL
                                    
                                    -- Recursive case: child tasks
                                    SELECT c.id, c.name, c.parent_task_id, c.description, c.total_minutes,
                                           c.sort_order, c.task_no, c.status_sort_order, c.priority_sort_order, c.phase_sort_order,
                                           c.status_id, c.priority_id, c.template_id,
                                           c.billable, c.start_offset_days, c.due_offset_days, c.task_duration_days,
                                           tt.depth + 1,
                                           tt.path || ARRAY[LPAD(c.sort_order::TEXT, 10, '0'), LPAD(COALESCE(c.task_no, 0)::TEXT, 10, '0'), c.id::TEXT]
                                    FROM cpt_tasks c
                                    INNER JOIN task_tree tt ON c.parent_task_id = tt.id
                                    WHERE c.template_id = pt.id
                                )
                                SELECT tt.id AS original_task_id,
                                       tt.name,
                                       tt.parent_task_id,
                                       tt.description,
                                       tt.total_minutes,
                                       tt.sort_order,
                                       tt.task_no,
                                       tt.status_sort_order,
                                       tt.priority_sort_order,
                                       tt.phase_sort_order,
                                       tt.billable,
                                       tt.start_offset_days,
                                       tt.due_offset_days,
                                       tt.task_duration_days,
                                       (SELECT name FROM cpt_task_statuses cts WHERE tt.status_id = cts.id) AS status_name,
                                       (SELECT name FROM task_priorities tp WHERE tt.priority_id = tp.id) AS priority_name,
                                       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                        FROM (SELECT name
                                                FROM cpt_phases pl
                                                WHERE pl.id =
                                                (SELECT phase_id FROM cpt_task_phases WHERE task_id = tt.id)) rec) AS phases,
                                       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                            FROM (SELECT name
                                                    FROM team_labels pl
                                                            LEFT JOIN cpt_task_labels cttl ON pl.id = cttl.label_id
                                                    WHERE cttl.task_id = tt.id) rec) AS labels
                                FROM task_tree tt
                                ORDER BY path
                           ) rec) AS tasks
                    FROM custom_project_templates pt
                    WHERE id = $1;`;
    const result = await db.query(q, [template_id]);
    const [data] = result.rows;
    if (data) {
      await this.enrichCustomTemplateTasksFromCpt(data);
    }
    return data;
  }

  /**
   * Loads assignees / dependencies / recurrence / rate-card rows from CPT tables
   * onto the getCustomTemplateData payload (schema_version 2+).
   */
  protected static async enrichCustomTemplateTasksFromCpt(data: any): Promise<void> {
    if (!data?.id) return;

    const includes = (data.includes || {}) as IProjectTemplateIncludesPayload;
    const taskIncludes = includes.task || {};
    const tasks: IProjectTemplateTask[] = Array.isArray(data.tasks) ? data.tasks : [];
    if (!tasks.length) return;

    const taskIds = tasks
      .map((t) => t.original_task_id)
      .filter((id): id is string => !!id);

    if (taskIncludes.assignees !== false) {
      try {
        const q = `
          SELECT task_id, team_member_id, email, name
          FROM cpt_task_assignees
          WHERE task_id = ANY($1::UUID[]);
        `;
        const result = await db.query(q, [taskIds]);
        const byTask = new Map<string, ICustomTemplateTaskAssignee[]>();
        for (const row of result.rows) {
          const list = byTask.get(row.task_id) || [];
          list.push({
            team_member_id: row.team_member_id,
            email: row.email,
            name: row.name,
          });
          byTask.set(row.task_id, list);
        }
        for (const task of tasks) {
          if (task.original_task_id) {
            task.assignees = byTask.get(task.original_task_id) || [];
          }
        }
      } catch (error) {
        log_error(error);
      }
    }

    if (taskIncludes.dependencies !== false) {
      try {
        const q = `
          SELECT task_id, related_task_id, dependency_type::TEXT AS dependency_type
          FROM cpt_task_dependencies
          WHERE task_id = ANY($1::UUID[]);
        `;
        const result = await db.query(q, [taskIds]);
        const byTask = new Map<string, ICustomTemplateTaskDependency[]>();
        for (const row of result.rows) {
          const list = byTask.get(row.task_id) || [];
          list.push({
            related_task_id: row.related_task_id,
            dependency_type: row.dependency_type || "blocked_by",
          });
          byTask.set(row.task_id, list);
        }
        for (const task of tasks) {
          if (task.original_task_id) {
            task.dependencies = byTask.get(task.original_task_id) || [];
          }
        }
      } catch (error) {
        log_error(error);
      }
    }

    if (taskIncludes.recurrence !== false) {
      try {
        const q = `
          SELECT
            ct.id AS task_id,
            crs.schedule_type::TEXT AS schedule_type,
            crs.days_of_week,
            crs.day_of_month,
            crs.date_of_month,
            crs.week_of_month,
            crs.interval_days,
            crs.interval_weeks,
            crs.interval_months,
            crs.end_offset_days,
            crs.max_occurrences,
            crs.recurring_mode::TEXT AS recurring_mode,
            crs.target_status_name,
            crs.timezone_name
          FROM cpt_tasks ct
          INNER JOIN cpt_task_recurring_schedules crs ON crs.id = ct.schedule_id
          WHERE ct.template_id = $1 AND ct.schedule_id IS NOT NULL;
        `;
        const result = await db.query(q, [data.id]);
        const byTask = new Map<string, ICustomTemplateTaskRecurrence>();
        for (const row of result.rows) {
          byTask.set(row.task_id, {
            schedule_type: row.schedule_type,
            days_of_week: row.days_of_week ?? null,
            day_of_month: row.day_of_month ?? null,
            date_of_month: row.date_of_month ?? null,
            week_of_month: row.week_of_month ?? null,
            interval_days: row.interval_days ?? null,
            interval_weeks: row.interval_weeks ?? null,
            interval_months: row.interval_months ?? null,
            end_offset_days: row.end_offset_days ?? null,
            max_occurrences: row.max_occurrences ?? null,
            recurring_mode:
              row.recurring_mode === "change_status" ? "change_status" : "create_task",
            target_status_name: row.target_status_name ?? null,
            timezone_name: row.timezone_name || "UTC",
          });
        }
        for (const task of tasks) {
          if (task.original_task_id && byTask.has(task.original_task_id)) {
            task.recurrence = byTask.get(task.original_task_id) || null;
          }
        }
      } catch (error) {
        log_error(error);
      }
    }

    // Attach rate card roles from CPT table onto settings.budget when present
    try {
      const q = `
        SELECT job_title_id, job_title_name, rate, man_day_rate
        FROM cpt_rate_card_roles
        WHERE template_id = $1
        ORDER BY job_title_name NULLS LAST;
      `;
      const result = await db.query(q, [data.id]);
      if (result.rows?.length) {
        if (!data.settings || typeof data.settings !== "object") {
          data.settings = {};
        }
        if (!data.settings.budget || typeof data.settings.budget !== "object") {
          data.settings.budget = { amount: 0, currency: "USD", rate_card: [] };
        }
        data.settings.budget.rate_card = result.rows.map((r: any) => ({
          job_title_id: r.job_title_id || null,
          job_title_name: r.job_title_name || "",
          rate: Number(r.rate) || 0,
          man_day_rate:
            r.man_day_rate !== null && r.man_day_rate !== undefined
              ? Number(r.man_day_rate)
              : null,
        }));
      }
    } catch (error) {
      log_error(error);
    }
  }

  private static async getAllKeysByTeamId(teamId?: string) {
    if (!teamId) return [];
    try {
      const result = await db.query(
        "SELECT key FROM projects WHERE team_id = $1;",
        [teamId],
      );
      return result.rows
        .map((project: any) => project.key)
        .filter((key: any) => !!key);
    } catch (error) {
      return [];
    }
  }

  private static async checkProjectNameExists(
    project_name: string,
    teamId?: string,
  ) {
    if (!teamId) return;
    try {
      const result = await db.query(
        "SELECT count(*) FROM projects WHERE name = $1 AND team_id = $2;",
        [project_name, teamId],
      );
      const [data] = result.rows;
      return int(data.count) || 0;
    } catch (error) {
      return [];
    }
  }

  /**
   * Merge template settings snapshot with review-step overrides for create_project.
   * Overrides win; missing keys fall back to template; never mutates the template row.
   */
  protected static mergeProjectSettingsForImport(
    templateSettings: IProjectTemplateSettingsSnapshot | null | undefined,
    overrides: IProjectTemplateSettingsOverrides | null | undefined
  ) {
    return mergeProjectSettingsForImport(templateSettings as any, overrides as any);
  }

  /** Validate category belongs to the team (or org sibling teams); null if invalid. */
  protected static async resolveImportCategoryId(
    categoryId: string | null,
    teamId?: string | null
  ): Promise<string | null> {
    if (!categoryId || !teamId) return null;
    try {
      const q = `
        SELECT pc.id
        FROM project_categories pc
        WHERE pc.id = $1
          AND pc.team_id IN (
            SELECT id FROM teams
            WHERE organization_id = (SELECT organization_id FROM teams WHERE id = $2)
          )
        LIMIT 1;
      `;
      const result = await db.query(q, [categoryId, teamId]);
      return result.rows[0]?.id || null;
    } catch {
      return null;
    }
  }

  /** Apply budget/currency after create_project (create_project does not accept them). */
  protected static async applyImportedBudget(
    projectId: string,
    budget: { amount: number | null; currency: string | null } | null
  ): Promise<void> {
    if (!budget) return;
    try {
      await db.query(
        `UPDATE projects SET budget = $1, currency = $2 WHERE id = $3;`,
        [budget.amount, budget.currency, projectId]
      );
    } catch (error) {
      log_error(error);
    }
  }

  /**
   * Resolve a stored team_member_id (or email) to an active member on the apply team.
   * Org-share ready: id may belong to another team in the same org — resolve by email
   * onto the apply team's member. No hard FK to source-team members.
   */
  protected static async resolveActiveTeamMemberId(
    teamMemberId: string | null | undefined,
    email: string | null | undefined,
    teamId: string
  ): Promise<string | null> {
    if (teamMemberId) {
      try {
        const q = `
          SELECT id FROM team_members
          WHERE id = $1 AND team_id = $2 AND active IS TRUE
          LIMIT 1;
        `;
        const result = await db.query(q, [teamMemberId, teamId]);
        if (result.rows[0]?.id) return result.rows[0].id;
      } catch (error) {
        log_error(error);
      }

      // Same org, different team: map via email of the stored member
      try {
        const q = `
          SELECT tm_apply.id
          FROM team_members tm_src
          INNER JOIN team_member_info_view v_src ON v_src.team_member_id = tm_src.id
          INNER JOIN teams t_src ON t_src.id = tm_src.team_id
          INNER JOIN teams t_apply ON t_apply.id = $2
            AND t_apply.organization_id IS NOT NULL
            AND t_apply.organization_id = t_src.organization_id
          INNER JOIN team_member_info_view v_apply
            ON LOWER(TRIM(v_apply.email)) = LOWER(TRIM(v_src.email))
          INNER JOIN team_members tm_apply
            ON tm_apply.id = v_apply.team_member_id
           AND tm_apply.team_id = $2
           AND tm_apply.active IS TRUE
          WHERE tm_src.id = $1
            AND v_src.email IS NOT NULL
            AND TRIM(v_src.email) <> ''
          LIMIT 1;
        `;
        const result = await db.query(q, [teamMemberId, teamId]);
        if (result.rows[0]?.id) return result.rows[0].id;
      } catch (error) {
        log_error(error);
      }
    }

    if (email) {
      try {
        const q = `
          SELECT tm.id
          FROM team_members tm
          INNER JOIN team_member_info_view tmiv ON tmiv.team_member_id = tm.id
          WHERE tm.team_id = $1
            AND tm.active IS TRUE
            AND LOWER(TRIM(tmiv.email)) = LOWER(TRIM($2))
          LIMIT 1;
        `;
        const result = await db.query(q, [teamId, email]);
        if (result.rows[0]?.id) return result.rows[0].id;
      } catch (error) {
        log_error(error);
      }
    }

    return null;
  }

  /** Prefetch active apply-team members for batched assignee resolution (8.1). */
  protected static async loadActiveTeamMemberLookup(teamId: string): Promise<{
    byId: Map<string, string>;
    byEmail: Map<string, string>;
  }> {
    const byId = new Map<string, string>();
    const byEmail = new Map<string, string>();
    try {
      const q = `
        SELECT tm.id, LOWER(TRIM(tmiv.email)) AS email
        FROM team_members tm
        LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = tm.id
        WHERE tm.team_id = $1 AND tm.active IS TRUE;
      `;
      const result = await db.query(q, [teamId]);
      for (const row of result.rows) {
        if (row.id) byId.set(row.id, row.id);
        if (row.email) byEmail.set(row.email, row.id);
      }
    } catch (error) {
      log_error(error);
    }
    return { byId, byEmail };
  }

  protected static async applyImportedProjectManager(
    projectId: string,
    requestedPmId: string | null,
    teamId: string,
    creatorUserId: string | null,
    skips: IProjectTemplateApplySkip[]
  ): Promise<void> {
    if (!requestedPmId) return;

    let resolved = await this.resolveActiveTeamMemberId(requestedPmId, null, teamId);

    if (!resolved && creatorUserId) {
      try {
        const q = `
          SELECT id FROM team_members
          WHERE user_id = $1 AND team_id = $2 AND active IS TRUE
          LIMIT 1;
        `;
        const result = await db.query(q, [creatorUserId, teamId]);
        resolved = result.rows[0]?.id || null;
        if (resolved) {
          skips.push({
            type: "project_manager",
            reason: "inactive_or_missing",
            detail: "Project manager was inactive or not on this team; fell back to project creator.",
          });
        }
      } catch (error) {
        log_error(error);
      }
    }

    if (!resolved) {
      skips.push({
        type: "project_manager",
        reason: "unresolved",
        detail: "Could not resolve project manager; left unset.",
      });
      return;
    }

    try {
      await db.query(`SELECT update_project_manager($1, $2);`, [resolved, projectId]);
    } catch (error) {
      log_error(error);
      skips.push({
        type: "project_manager",
        reason: "apply_failed",
        detail: "Failed to set project manager.",
      });
    }
  }

  /**
   * Phase 5 — template creator becomes PM with finance_access off (D7).
   * Does not use update_project_manager (that defaults finance on).
   */
  protected static async assignTemplateCreatorAsPm(
    projectId: string,
    teamMemberId: string | null | undefined,
    skips: IProjectTemplateApplySkip[]
  ): Promise<void> {
    if (!projectId || !teamMemberId) return;

    try {
      const memberResult = await db.query(
        `SELECT id, team_id, user_id FROM team_members WHERE id = $1 AND active IS TRUE LIMIT 1;`,
        [teamMemberId]
      );
      const member = memberResult.rows[0];
      if (!member) {
        skips.push({
          type: "project_manager",
          reason: "creator_unresolved",
          detail: "Could not resolve project creator as project manager.",
        });
        return;
      }

      const existing = await db.query(
        `SELECT id FROM project_members
         WHERE project_id = $1 AND team_member_id = $2
         LIMIT 1;`,
        [projectId, teamMemberId]
      );

      if (existing.rows[0]?.id) {
        await db.query(
          `UPDATE project_members
           SET project_access_level_id = (
                 SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
               ),
               finance_access = FALSE
           WHERE id = $1;`,
          [existing.rows[0].id]
        );
        return;
      }

      await db.query(
        `SELECT create_project_member($1);`,
        [
          JSON.stringify({
            team_member_id: teamMemberId,
            team_id: member.team_id,
            project_id: projectId,
            user_id: member.user_id,
            access_level: "PROJECT_MANAGER",
          }),
        ]
      );

      await db.query(
        `UPDATE project_members
         SET finance_access = FALSE
         WHERE project_id = $1
           AND team_member_id = $2
           AND project_access_level_id = (
             SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
           );`,
        [projectId, teamMemberId]
      );
    } catch (error) {
      log_error(error);
      skips.push({
        type: "project_manager",
        reason: "creator_apply_failed",
        detail: "Failed to set project creator as project manager.",
      });
    }
  }

  /**
   * Phase 5 — apply template PM rules:
   * - Creator always becomes PM with finance off.
   * - Non-admin creators cannot assign a different template PM (skip + report).
   * - Owner/Admin may still apply a different template PM (finance on via update_project_manager).
   */
  protected static async applyTemplateProjectManagers(
    projectId: string,
    templatePmId: string | null | undefined,
    teamId: string,
    creatorUserId: string | null,
    creatorTeamMemberId: string | null | undefined,
    isTeamAdmin: boolean,
    skips: IProjectTemplateApplySkip[]
  ): Promise<void> {
    await this.assignTemplateCreatorAsPm(projectId, creatorTeamMemberId, skips);

    if (!templatePmId) return;

    const resolved = await this.resolveActiveTeamMemberId(templatePmId, null, teamId);
    if (resolved && creatorTeamMemberId && resolved === creatorTeamMemberId) {
      // Creator is already PM with finance off — do not re-run update_project_manager
      // (that would flip finance on).
      return;
    }

    if (!isTeamAdmin) {
      skips.push({
        type: "project_manager",
        reason: "non_admin_cannot_assign_pm",
        detail:
          "Template project manager was skipped because only Owner/Admin can assign another PM.",
      });
      return;
    }

    await this.applyImportedProjectManager(
      projectId,
      templatePmId,
      teamId,
      creatorUserId,
      skips
    );
  }

  protected static async applyImportedTaskAssignees(
    tasks: IProjectTemplateTask[],
    templateIdToNewIdMap: Map<string, string>,
    projectId: string,
    teamId: string,
    reporterUserId: string,
    skips: IProjectTemplateApplySkip[]
  ): Promise<void> {
    const lookup = await this.loadActiveTeamMemberLookup(teamId);
    const assignments: Array<{
      teamMemberId: string;
      taskId: string;
      label: string;
    }> = [];

    for (const task of tasks) {
      if (!task.original_task_id || !task.assignees?.length) continue;
      const newTaskId = templateIdToNewIdMap.get(task.original_task_id);
      if (!newTaskId) continue;

      for (const assignee of task.assignees) {
        let resolved: string | null = null;
        if (assignee.team_member_id && lookup.byId.has(assignee.team_member_id)) {
          resolved = lookup.byId.get(assignee.team_member_id) || null;
        } else if (assignee.email) {
          resolved = lookup.byEmail.get(assignee.email.trim().toLowerCase()) || null;
        }

        // Fallback: org-share / cross-team id resolution (not in local prefetch)
        if (!resolved) {
          resolved = await this.resolveActiveTeamMemberId(
            assignee.team_member_id,
            assignee.email,
            teamId
          );
        }

        if (!resolved) {
          skips.push({
            type: "assignee",
            reason: "inactive_or_missing",
            detail: assignee.email || assignee.name || assignee.team_member_id,
          });
          continue;
        }

        assignments.push({
          teamMemberId: resolved,
          taskId: newTaskId,
          label: assignee.email || assignee.name || resolved,
        });
      }
    }

    for (const batch of chunkArray(assignments, 25)) {
      await Promise.all(
        batch.map(async (item) => {
          try {
            await db.query(`SELECT create_task_assignee($1, $2, $3, $4);`, [
              item.teamMemberId,
              projectId,
              item.taskId,
              reporterUserId,
            ]);
          } catch (error) {
            log_error(error);
            skips.push({
              type: "assignee",
              reason: "apply_failed",
              detail: item.label,
            });
          }
        })
      );
    }
  }

  protected static async applyImportedTaskDependencies(
    tasks: IProjectTemplateTask[],
    templateIdToNewIdMap: Map<string, string>,
    skips: IProjectTemplateApplySkip[]
  ): Promise<void> {
    const edges: Array<{
      taskTemplateId: string;
      relatedTemplateId: string;
      dependencyType?: string;
      taskName?: string;
    }> = [];

    for (const task of tasks) {
      if (!task.original_task_id || !task.dependencies?.length) continue;
      for (const dep of task.dependencies) {
        edges.push({
          taskTemplateId: task.original_task_id,
          relatedTemplateId: dep.related_task_id,
          dependencyType: dep.dependency_type,
          taskName: task.name,
        });
      }
    }

    const { inserts, skipped } = remapTemplateDependencies(edges, templateIdToNewIdMap);
    for (const s of skipped) {
      skips.push({
        type: "dependency",
        reason: s.reason,
        detail: `Dependency from ${s.taskName || "task"} could not be remapped.`,
      });
    }

    for (const batch of chunkArray(inserts, 50)) {
      if (!batch.length) continue;
      const values: unknown[] = [];
      const placeholders = batch.map((row, i) => {
        const base = i * 3;
        values.push(row.taskId, row.relatedTaskId, row.dependencyType);
        return `($${base + 1}, $${base + 2}, COALESCE($${base + 3}::DEPENDENCY_TYPE, 'blocked_by'::DEPENDENCY_TYPE))`;
      });
      try {
        await db.query(
          `INSERT INTO task_dependencies (task_id, related_task_id, dependency_type)
           VALUES ${placeholders.join(", ")}
           ON CONFLICT (task_id, related_task_id, dependency_type) DO NOTHING;`,
          values
        );
      } catch (error) {
        log_error(error);
        // Fall back to per-row so one bad edge doesn't drop the batch
        for (const row of batch) {
          try {
            await db.query(
              `INSERT INTO task_dependencies (task_id, related_task_id, dependency_type)
               VALUES ($1, $2, COALESCE($3::DEPENDENCY_TYPE, 'blocked_by'::DEPENDENCY_TYPE))
               ON CONFLICT (task_id, related_task_id, dependency_type) DO NOTHING;`,
              [row.taskId, row.relatedTaskId, row.dependencyType]
            );
          } catch (rowError) {
            log_error(rowError);
            skips.push({
              type: "dependency",
              reason: "apply_failed",
              detail: row.taskId,
            });
          }
        }
      }
    }
  }

  protected static async applyImportedTaskRecurrence(
    tasks: IProjectTemplateTask[],
    templateIdToNewIdMap: Map<string, string>,
    projectId: string,
    projectStartDate: string | Date | null | undefined,
    userId: string | null,
    skips: IProjectTemplateApplySkip[]
  ): Promise<void> {
    const recurringTasks = tasks.filter(
      (task) => task.original_task_id && task.recurrence?.schedule_type && templateIdToNewIdMap.get(task.original_task_id)
    );
    if (!recurringTasks.length) return;

    for (const batch of chunkArray(recurringTasks, 25)) {
      await Promise.all(
        batch.map(async (task) => {
          const newTaskId = templateIdToNewIdMap.get(task.original_task_id as string) as string;
          const recurrence = task.recurrence as NonNullable<IProjectTemplateTask["recurrence"]>;
          try {
            let timezoneId: string | null = null;
            if (recurrence.timezone_name) {
              const tz = await db.query(
                `SELECT id FROM timezones WHERE name = $1 OR abbrev = $1 LIMIT 1;`,
                [recurrence.timezone_name]
              );
              timezoneId = tz.rows[0]?.id || null;
            }
            if (!timezoneId && userId) {
              const tz = await db.query(`SELECT timezone_id FROM users WHERE id = $1;`, [userId]);
              timezoneId = tz.rows[0]?.timezone_id || null;
            }

            let targetStatusId: string | null = null;
            if (recurrence.recurring_mode === "change_status" && recurrence.target_status_name) {
              const st = await db.query(
                `SELECT id FROM task_statuses WHERE project_id = $1 AND name = $2 LIMIT 1;`,
                [projectId, recurrence.target_status_name]
              );
              targetStatusId = st.rows[0]?.id || null;
            }

            const scheduleStart =
              projectStartDate != null && projectStartDate !== ""
                ? applyOffsetDate(projectStartDate, task.start_offset_days)
                : null;
            const scheduleEnd =
              projectStartDate != null && projectStartDate !== ""
                ? applyOffsetDate(projectStartDate, recurrence.end_offset_days)
                : null;

            const insertQ = `
              INSERT INTO task_recurring_schedules (
                schedule_type, days_of_week, day_of_month, date_of_month, week_of_month,
                interval_days, interval_weeks, interval_months,
                start_date, end_date, max_occurrences, recurring_mode, target_status_id,
                timezone_id, created_by, is_active
              ) VALUES (
                $1::SCHEDULE_TYPE, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15, TRUE
              )
              RETURNING id;
            `;
            const result = await db.query(insertQ, [
              recurrence.schedule_type,
              recurrence.days_of_week || null,
              recurrence.day_of_month ?? null,
              recurrence.date_of_month ?? null,
              recurrence.week_of_month ?? null,
              recurrence.interval_days ?? null,
              recurrence.interval_weeks ?? null,
              recurrence.interval_months ?? null,
              scheduleStart,
              scheduleEnd,
              recurrence.max_occurrences ?? null,
              recurrence.recurring_mode === "change_status" ? "change_status" : "create_task",
              targetStatusId,
              timezoneId,
              userId,
            ]);
            const scheduleId = result.rows[0]?.id;
            if (!scheduleId) {
              skips.push({
                type: "recurrence",
                reason: "apply_failed",
                detail: task.name || task.original_task_id,
              });
              return;
            }

            await db.query(`UPDATE tasks SET schedule_id = $1 WHERE id = $2;`, [
              scheduleId,
              newTaskId,
            ]);
            await db.query(`SELECT create_recurring_task_template($1, $2);`, [
              newTaskId,
              scheduleId,
            ]);
          } catch (error) {
            log_error(error);
            skips.push({
              type: "recurrence",
              reason: "apply_failed",
              detail: task.name || task.original_task_id,
            });
          }
        })
      );
    }
  }

  protected static async applyImportedRateCard(
    projectId: string,
    teamId: string,
    rateCard: ICustomTemplateRateCardRole[] | null | undefined,
    skips: IProjectTemplateApplySkip[]
  ): Promise<void> {
    if (!rateCard?.length) return;

    for (const role of rateCard) {
      let jobTitleId: string | null = role.job_title_id || null;

      if (jobTitleId) {
        try {
          const check = await db.query(
            `SELECT id FROM job_titles WHERE id = $1 AND team_id = $2 LIMIT 1;`,
            [jobTitleId, teamId]
          );
          if (!check.rows[0]?.id) jobTitleId = null;
        } catch {
          jobTitleId = null;
        }
      }

      if (!jobTitleId && role.job_title_name) {
        try {
          const byName = await db.query(
            `SELECT id FROM job_titles
             WHERE team_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
             LIMIT 1;`,
            [teamId, role.job_title_name]
          );
          jobTitleId = byName.rows[0]?.id || null;
        } catch (error) {
          log_error(error);
        }
      }

      if (!jobTitleId) {
        skips.push({
          type: "rate_card_role",
          reason: "job_title_missing",
          detail: role.job_title_name || role.job_title_id || "unknown",
        });
        continue;
      }

      try {
        await db.query(
          `INSERT INTO finance_project_rate_card_roles (project_id, job_title_id, rate, man_day_rate)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id, job_title_id) DO UPDATE SET
             rate = EXCLUDED.rate,
             man_day_rate = EXCLUDED.man_day_rate;`,
          [
            projectId,
            jobTitleId,
            Number(role.rate) || 0,
            role.man_day_rate !== null && role.man_day_rate !== undefined
              ? Number(role.man_day_rate)
              : null,
          ]
        );
      } catch (error) {
        log_error(error);
        skips.push({
          type: "rate_card_role",
          reason: "apply_failed",
          detail: role.job_title_name || jobTitleId,
        });
      }
    }
  }

  /** template/onboarding projects skip ProjectsController.create, so they log here. */
  protected static logProjectCreatedFromTemplate(user: IPassportSession | undefined, projectName: string): void {
    if (!user?.organization_id) return;
    logAuditEvent({
      organizationId: user.organization_id,
      teamId: user.team_id || null,
      actor: actorFromSessionUser(user),
      eventType: AUDIT_EVENT_TYPE.PROJECT_CREATED.id,
      description: `Created project "${projectName}" from a template`,
    });
  }

 protected static async importTemplate(body: any) {
    const q = `SELECT create_project($1) AS project`;

    const originalName = body.name;
    let keys = await this.getAllKeysByTeamId(body.team_id as string);
    let counter = 1;
    const maxRetries = 10;

    while (counter <= maxRetries) {
      body.name = counter === 1 ? originalName : `${originalName} (${counter})`;
      body.key = generateProjectKey(body.name, keys) || null;

      try {
        const result = await db.query(q, [JSON.stringify(body)]);
        const [data] = result.rows;
        return data.project.id;
      } catch (error: any) {
        if (
          (error.code === '23505' && error.constraint === 'projects_key_team_id_uindex') ||
          (error.code === 'P0001' && error.message?.includes('PROJECT_EXISTS_ERROR'))
        ) {
          keys.push(body.key);
          counter++;
        } else {
          throw error;
        }
      }
    }

    throw new Error('Failed to create project after maximum retries');
  }


  @HandleExceptions()
  protected static async insertTeamLabels(
    labels: IProjectTemplateLabel[],
    team_id = "",
  ) {
    if (!team_id) return;

    for await (const label of labels) {
      const q = `INSERT INTO team_labels(name, color_code, team_id)
                 SELECT TRIM($1), $2, $3
                 WHERE NOT EXISTS (
                   SELECT 1
                   FROM team_labels
                   WHERE team_id = $3
                     AND LOWER(TRIM(name)) = LOWER(TRIM($1))
                 );`;
      await db.query(q, [label.name, label.color_code, team_id]);
    }
  }

  @HandleExceptions()
  protected static async insertProjectPhases(
    phases: IProjectTemplatePhase[],
    project_id = "",
  ) {
    if (!project_id) return;

    let i = 0;

    for await (const phase of phases) {
      const q = `INSERT INTO project_phases(name, color_code, project_id, sort_index) VALUES ($1, $2, $3, $4);`;
      await db.query(q, [phase.name, phase.color_code, project_id, i]);
      i++;
    }
  }

  protected static async insertProjectStatuses(
    statuses: IProjectTemplateStatus[],
    project_id = "",
    team_id = "",
  ) {
    if (!project_id || !team_id) return;

    try {
      let index = 0;
      for await (const status of statuses) {
        // Use status.sort_order if available, otherwise use index to maintain order
        const sortOrder = status.sort_order !== undefined ? status.sort_order : index;
        
        const q = `INSERT INTO task_statuses(name, project_id, team_id, category_id, sort_order) VALUES($1, $2, $3, $4, $5);`;
        await db.query(q, [
          status.name,
          project_id,
          team_id,
          status.category_id,
          sortOrder,
        ]);
        
        index++;
      }
    } catch (error) {
      log_error(error);
    }
  }

  @HandleExceptions()
  protected static async insertTaskPhase(
    task_id: string,
    phase_name: string,
    project_id: string,
  ) {
    const q = `INSERT INTO task_phase(task_id, phase_id)
                VALUES ($1, (SELECT id FROM project_phases WHERE name = $2 AND project_id = $3));`;
    await db.query(q, [task_id, phase_name, project_id]);
  }

  @HandleExceptions()
  protected static async insertTaskLabel(
    task_id: string,
    label_name: string,
    team_id: string,
  ) {
    const q = `INSERT INTO task_labels(task_id, label_id)
                VALUES ($1, (SELECT id FROM team_labels WHERE name = $2 AND team_id = $3));`;
    await db.query(q, [task_id, label_name, team_id]);
  }

  protected static async insertProjectTasks(
    tasks: IProjectTemplateTask[],
    team_id: string,
    project_id = "",
    user_id = "",
    socket: Socket | null,
  ) {
    if (!project_id) return;

    try {
      for await (const [key, task] of tasks.entries()) {
        const q = `INSERT INTO tasks(name, project_id, status_id, priority_id, reporter_id,
                              sort_order, roadmap_sort_order,
                              status_sort_order, priority_sort_order, phase_sort_order, member_sort_order)
                    VALUES ($1, $2, (SELECT id FROM task_statuses ts WHERE ts.name = $3 AND ts.project_id = $2),
                            (SELECT id FROM task_priorities tp WHERE tp.name = $4), $5,
                            $6, $6,
                            $6, $6, $6, $6)
                    RETURNING id, status_id;`;
        const result = await db.query(q, [
          task.name,
          project_id,
          task.status_name,
          task.priority_name,
          user_id,
          key,
        ]);
        const [data] = result.rows;

        if (task.phases) {
          for await (const phase of task.phases) {
            await this.insertTaskPhase(
              data.id,
              phase.name as string,
              project_id,
            );
          }
        }

        if (task.labels) {
          for await (const label of task.labels) {
            await this.insertTaskLabel(data.id, label.name as string, team_id);
          }
        }

        if (socket) {
          logStatusChange({
            task_id: data.id,
            socket,
            new_value: data.status_id,
            old_value: null,
          });
        }
      }

      // Set progress_value = 100 for all tasks that are in a "Done" status category
      const progressUpdateQ = `
        UPDATE tasks
        SET progress_value = 100, manual_progress = TRUE
        WHERE project_id = $1
          AND status_id IN (
            SELECT ts.id
            FROM task_statuses ts
            JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
            WHERE ts.project_id = $1
              AND stsc.is_done IS TRUE
          )
      `;
      await db.query(progressUpdateQ, [project_id]);
    } catch (error) {
      log_error(error);
    }
  }

  // custom templates
  @HandleExceptions()
  protected static async getProjectData(project_id: string) {
    const q = `
      SELECT
        phase_label,
        notes,
        color_code,
        start_date,
        end_date,
        CASE
          WHEN start_date IS NOT NULL AND end_date IS NOT NULL
            THEN (DATE(end_date AT TIME ZONE 'UTC') - DATE(start_date AT TIME ZONE 'UTC'))
          ELSE NULL
        END AS project_duration_days
      FROM projects
      WHERE id = $1;
    `;
    const result = await db.query(q, [project_id]);
    const [data] = result.rows;
    return data;
  }

  /**
   * Builds a project-settings snapshot for template save based on include toggles.
   * Only keys for enabled toggles are returned.
   */
  @HandleExceptions()
  protected static async getProjectSettingsSnapshot(
    project_id: string,
    settingsIncludes: IProjectSettingsIncludes = {},
    projectDurationDays?: number | null
  ): Promise<IProjectTemplateSettingsSnapshot> {
    const snapshot: IProjectTemplateSettingsSnapshot = {};

    if (projectDurationDays !== null && projectDurationDays !== undefined) {
      snapshot.project_duration_days = Number(projectDurationDays);
    }

    const needsProjectRow =
      settingsIncludes.category ||
      settingsIncludes.projectManager ||
      settingsIncludes.estimatedWorkingDays ||
      settingsIncludes.estimatedManDays ||
      settingsIncludes.hoursPerDay ||
      settingsIncludes.advanced ||
      settingsIncludes.budget;

    if (!needsProjectRow) {
      return snapshot;
    }

    const q = `
      SELECT
        p.category_id,
        (SELECT name FROM project_categories WHERE id = p.category_id) AS category_name,
        p.estimated_working_days,
        p.estimated_man_days,
        p.hours_per_day,
        p.budget,
        p.currency,
        p.use_manual_progress,
        p.use_weighted_progress,
        p.use_time_progress,
        p.auto_assign_task_creator,
        p.restrict_task_creation,
        p.phase_assignees_enabled,
        (
          SELECT pm.team_member_id
          FROM project_members pm
          WHERE pm.project_id = p.id
            AND pm.project_access_level_id = (
              SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER' LIMIT 1
            )
          LIMIT 1
        ) AS project_manager_id
      FROM projects p
      WHERE p.id = $1;
    `;
    const result = await db.query(q, [project_id]);
    const [row] = result.rows;
    if (!row) return snapshot;

    if (settingsIncludes.category) {
      snapshot.category_id = row.category_id || null;
      snapshot.category_name = row.category_name || null;
    }
    if (settingsIncludes.projectManager) {
      snapshot.project_manager_id = row.project_manager_id || null;
    }
    if (settingsIncludes.estimatedWorkingDays) {
      snapshot.estimated_working_days =
        row.estimated_working_days !== null && row.estimated_working_days !== undefined
          ? Number(row.estimated_working_days)
          : null;
    }
    if (settingsIncludes.estimatedManDays) {
      snapshot.estimated_man_days =
        row.estimated_man_days !== null && row.estimated_man_days !== undefined
          ? Number(row.estimated_man_days)
          : null;
    }
    if (settingsIncludes.hoursPerDay) {
      snapshot.hours_per_day =
        row.hours_per_day !== null && row.hours_per_day !== undefined
          ? Number(row.hours_per_day)
          : null;
    }
    if (settingsIncludes.advanced) {
      snapshot.advanced = {
        use_manual_progress: Boolean(row.use_manual_progress),
        use_weighted_progress: Boolean(row.use_weighted_progress),
        use_time_progress: Boolean(row.use_time_progress),
        auto_assign_task_creator: Boolean(row.auto_assign_task_creator),
        restrict_task_creation: Boolean(row.restrict_task_creation),
        phase_assignees_enabled: Boolean(row.phase_assignees_enabled),
      };
    }
    if (settingsIncludes.budget) {
      const rateCard = await this.getProjectRateCardForTemplate(project_id);
      snapshot.budget = {
        amount: row.budget !== null && row.budget !== undefined ? Number(row.budget) : 0,
        currency: row.currency || "USD",
        rate_card: rateCard,
      };
    }

    return snapshot;
  }

  @HandleExceptions()
  protected static async getProjectRateCardForTemplate(
    project_id: string
  ): Promise<ICustomTemplateRateCardRole[]> {
    const q = `
      SELECT
        fprr.job_title_id,
        COALESCE(jt.name, '') AS job_title_name,
        COALESCE(fprr.rate, 0) AS rate,
        fprr.man_day_rate
      FROM finance_project_rate_card_roles fprr
      LEFT JOIN job_titles jt ON jt.id = fprr.job_title_id
      WHERE fprr.project_id = $1
      ORDER BY jt.name NULLS LAST;
    `;
    try {
      const result = await db.query(q, [project_id]);
      return (result.rows || []).map((r: any) => ({
        job_title_id: r.job_title_id || null,
        job_title_name: r.job_title_name || "",
        rate: Number(r.rate) || 0,
        man_day_rate:
          r.man_day_rate !== null && r.man_day_rate !== undefined
            ? Number(r.man_day_rate)
            : null,
      }));
    } catch (error) {
      // Rate card table may be unavailable on older DBs — skip rather than fail save.
      log_error(error);
      return [];
    }
  }

  @HandleExceptions()
  protected static async insertTemplateRateCardRoles(
    template_id: string,
    roles: ICustomTemplateRateCardRole[]
  ) {
    for await (const role of roles) {
      if (!role.job_title_name && !role.job_title_id) continue;
      const q = `
        INSERT INTO cpt_rate_card_roles (template_id, job_title_id, job_title_name, rate, man_day_rate)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await db.query(q, [
        template_id,
        role.job_title_id || null,
        role.job_title_name || "",
        role.rate ?? 0,
        role.man_day_rate ?? null,
      ]);
    }
  }

  @HandleExceptions()
  protected static async getProjectStatus(project_id: string) {
    const q = `SELECT name, category_id, sort_order FROM task_statuses WHERE project_id = $1;`;
    const result = await db.query(q, [project_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async getProjectPhases(project_id: string) {
    const q = `SELECT name, color_code FROM project_phases WHERE project_id = $1 ORDER BY sort_index ASC;`;
    const result = await db.query(q, [project_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async getProjectLabels(team_id: string, project_id: string) {
    const q = `SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(DISTINCT JSONB_BUILD_OBJECT('name', name))), '[]'::JSON) AS labels
            FROM team_labels
            WHERE team_id = $1
            AND id IN (SELECT label_id
                        FROM task_labels
                        WHERE task_id IN (SELECT id
                                        FROM tasks
                                        WHERE project_id = $2));`;
    const result = await db.query(q, [team_id, project_id]);
    const [data] = result.rows;
    return data.labels;
  }

  @HandleExceptions()
  protected static async getTasksByProject(
    project_id: string,
    taskIncludes: ITaskIncludes,
    projectStartDate?: string | Date | null,
  ) {
    let taskIncludesClause = "";
    let whereClause = "WHERE project_id = $1 AND archived IS FALSE";

    // status_name is always required to insert into cpt_tasks (status_id NOT NULL)
    taskIncludesClause += ` (SELECT name FROM task_statuses WHERE task_statuses.id = t.status_id) AS status_name,`;

    if (taskIncludes.description) taskIncludesClause += " description,";
    if (taskIncludes.estimation) taskIncludesClause += " total_minutes,";
    if (taskIncludes.billable) taskIncludesClause += " billable,";

    const includeDateOffsets = taskIncludes.dateOffsets !== false;
    if (includeDateOffsets) {
      taskIncludesClause += " start_date, end_date,";
    }

    if (taskIncludes.assignees) {
      taskIncludesClause += ` (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (
                      SELECT
                        ta.team_member_id,
                        (SELECT email FROM team_member_info_view tmiv WHERE tmiv.team_member_id = ta.team_member_id LIMIT 1) AS email,
                        (SELECT name FROM team_member_info_view tmiv WHERE tmiv.team_member_id = ta.team_member_id LIMIT 1) AS name
                      FROM tasks_assignees ta
                      WHERE ta.task_id = t.id
                    ) rec) AS assignees,`;
    }

    if (taskIncludes.dependencies) {
      taskIncludesClause += ` (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (
                      SELECT
                        td.related_task_id,
                        td.dependency_type::TEXT AS dependency_type
                      FROM task_dependencies td
                      WHERE td.task_id = t.id
                        AND td.related_task_id IN (
                          SELECT id FROM tasks WHERE project_id = $1 AND archived IS FALSE
                        )
                    ) rec) AS dependencies,`;
    }

    if (taskIncludes.recurrence) {
      taskIncludesClause += ` schedule_id,
                    (SELECT ROW_TO_JSON(rec)
                      FROM (
                        SELECT
                          trs.schedule_type::TEXT AS schedule_type,
                          trs.days_of_week,
                          trs.day_of_month,
                          trs.date_of_month,
                          trs.week_of_month,
                          trs.interval_days,
                          trs.interval_weeks,
                          trs.interval_months,
                          trs.end_date AS schedule_end_date,
                          trs.max_occurrences,
                          trs.recurring_mode::TEXT AS recurring_mode,
                          (SELECT name FROM task_statuses WHERE id = trs.target_status_id) AS target_status_name,
                          COALESCE((SELECT name FROM timezones WHERE id = trs.timezone_id), 'UTC') AS timezone_name
                        FROM task_recurring_schedules trs
                        WHERE trs.id = t.schedule_id
                      ) rec) AS recurrence,`;
    }

    if (taskIncludes.labels) {
      taskIncludesClause += ` (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT (SELECT name FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = t.id) rec) AS labels,`;
    }
    if (taskIncludes.phase) {
      taskIncludesClause += ` (SELECT name
                    FROM project_phases
                    WHERE project_phases.id = (SELECT phase_id FROM task_phase WHERE task_id = t.id)) AS phase_name,`;
    }
    if (taskIncludes.subtasks) {
      taskIncludesClause += ` parent_task_id,`;
    } else {
      whereClause += " AND parent_task_id IS NULL";
    }

    const q = `SELECT id,
                name,
                sort_order,
                task_no,
                status_sort_order,
                priority_sort_order,
                phase_sort_order,
                ${taskIncludesClause}
                priority_id
            FROM tasks t
                ${whereClause}
            ORDER BY parent_task_id NULLS FIRST, sort_order ASC, task_no ASC;`;
    const result = await db.query(q, [project_id]);

    return result.rows.map((task: any) => {
      const mapped: IProjectTemplateTask = { ...task };

      if (includeDateOffsets) {
        mapped.start_offset_days = calendarDayOffset(projectStartDate, task.start_date);
        mapped.due_offset_days = calendarDayOffset(projectStartDate, task.end_date);
        mapped.task_duration_days =
          task.start_date && task.end_date
            ? calendarDayOffset(task.start_date, task.end_date)
            : null;
      }

      if (taskIncludes.recurrence && task.recurrence) {
        const rec = task.recurrence as ICustomTemplateTaskRecurrence & {
          schedule_end_date?: string | Date | null;
        };
        mapped.recurrence = {
          schedule_type: rec.schedule_type,
          days_of_week: rec.days_of_week ?? null,
          day_of_month: rec.day_of_month ?? null,
          date_of_month: rec.date_of_month ?? null,
          week_of_month: rec.week_of_month ?? null,
          interval_days: rec.interval_days ?? null,
          interval_weeks: rec.interval_weeks ?? null,
          interval_months: rec.interval_months ?? null,
          end_offset_days: calendarDayOffset(projectStartDate, rec.schedule_end_date),
          max_occurrences: rec.max_occurrences ?? null,
          recurring_mode:
            rec.recurring_mode === "change_status" ? "change_status" : "create_task",
          target_status_name: rec.target_status_name ?? null,
          timezone_name: rec.timezone_name || "UTC",
        };
      } else if (taskIncludes.recurrence) {
        mapped.recurrence = null;
      }

      if (taskIncludes.assignees) {
        mapped.assignees = (task.assignees || []) as ICustomTemplateTaskAssignee[];
      }
      if (taskIncludes.dependencies) {
        mapped.dependencies = (task.dependencies || []) as ICustomTemplateTaskDependency[];
      }

      // Never persist absolute source dates on the template payload
      delete (mapped as any).start_date;
      delete (mapped as any).end_date;
      delete (mapped as any).schedule_id;

      return mapped;
    });
  }

  @HandleExceptions()
  protected static async insertCustomTemplate(body: ICustomProjectTemplate) {
    const q = `SELECT create_project_template($1)`;
    const result = await db.query(q, [JSON.stringify(body)]);
    const [data] = result.rows;
    return data.id;
  }

  @HandleExceptions()
  protected static async insertCustomTemplatePhases(
    body: ICustomTemplatePhase[],
    template_id: string,
  ) {
    for await (const phase of body) {
      const { name, color_code } = phase;

      const q = `INSERT INTO cpt_phases(name, color_code, template_id) VALUES ($1, $2, $3);`;
      await db.query(q, [name, color_code, template_id]);
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateStatus(
    body: IProjectTemplateStatus[],
    template_id: string,
    team_id: string,
  ) {
    for await (const status of body) {
      const { name, category_id, sort_order } = status;

      const q = `INSERT INTO cpt_task_statuses(name, template_id, team_id, category_id, sort_order)
                    VALUES ($1, $2, $3, $4, $5);`;
      await db.query(q, [name, template_id, team_id, category_id, sort_order]);
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTasks(
    body: IProjectTemplateTask[],
    template_id: string,
    team_id: string,
    status = true,
  ) {
    // Two-pass approach to handle nested subtasks (3+ levels):
    // Pass 1: Insert all tasks without parent_task_id, storing original_task_id for mapping
    // Pass 2: Update parent_task_id relationships using the mapping
    // Pass 3: Assignees, dependencies (remapped), recurrence schedules

    const taskIdMap: Map<string, string> = new Map(); // original task id -> new cpt_task id

    // Pass 1: Insert all tasks without parent relationships
    for await (const task of body) {
      const {
        name,
        description,
        total_minutes,
        sort_order,
        status_name,
        task_no,
        id,
        phase_name,
        status_sort_order,
        priority_sort_order,
        phase_sort_order,
        billable,
        start_offset_days,
        due_offset_days,
        task_duration_days,
      } = task;

      let priority_id = task.priority_id;
      if (!priority_id && task.priority_name) {
        const priorityResult = await db.query(
          `SELECT id FROM task_priorities WHERE LOWER(name) = LOWER($1) LIMIT 1;`,
          [task.priority_name]
        );
        priority_id = priorityResult.rows[0]?.id;
      }
      if (!priority_id) {
        const fallbackPriority = await db.query(
          `SELECT id FROM task_priorities WHERE value = 1 LIMIT 1;`
        );
        priority_id = fallbackPriority.rows[0]?.id;
      }

      const descriptionValue =
        description === undefined ? null : description;
      const totalMinutesValue = normalizeTotalMinutes(total_minutes);

      const q = `INSERT INTO cpt_tasks(
                      name, description, total_minutes, sort_order, priority_id, template_id, status_id, task_no,
                      parent_task_id, original_task_id, status_sort_order, priority_sort_order, phase_sort_order,
                      billable, start_offset_days, due_offset_days, task_duration_days)
                        VALUES (
                          $1, $2, $3, $4, $5, $6,
                          (SELECT id FROM cpt_task_statuses cts WHERE cts.name = $7 AND cts.template_id = $6),
                          $8,
                          NULL, $9, $10, $11, $12,
                          $13, $14, $15, $16)
                        RETURNING id;`;

      // task_no is NOT NULL — never insert null (built-in / editor payloads often omit it)
      const resolvedTaskNo =
        task_no !== undefined && task_no !== null && Number.isFinite(Number(task_no))
          ? Number(task_no)
          : (((await db.query(
              `SELECT COUNT(*)::int AS c FROM cpt_tasks WHERE template_id = $1;`,
              [template_id]
            )).rows[0]?.c as number | undefined) ?? 0) + 1;

      const result = await db.query(q, [
        name,
        descriptionValue,
        totalMinutesValue,
        sort_order,
        priority_id,
        template_id,
        status_name,
        resolvedTaskNo || 1,
        id,
        status_sort_order || 0,
        priority_sort_order || 0,
        phase_sort_order || 0,
        billable === undefined || billable === null ? true : Boolean(billable),
        start_offset_days ?? null,
        due_offset_days ?? null,
        task_duration_days ?? null,
      ]);
      const [data] = result.rows;

      if (id && data.id) {
        taskIdMap.set(id, data.id);
      }

      if (data.id) {
        if (phase_name)
          await this.insertCustomTemplateTaskPhases(
            data.id,
            template_id,
            phase_name,
          );
        if (task.labels)
          await this.insertCustomTemplateTaskLabels(
            data.id,
            task.labels,
            team_id,
          );
      }
    }

    // Pass 2: Update parent_task_id relationships
    for await (const task of body) {
      if (task.parent_task_id && task.id) {
        const newTaskId = taskIdMap.get(task.id);
        const newParentId = taskIdMap.get(task.parent_task_id);

        if (newTaskId && newParentId) {
          const updateQ = `UPDATE cpt_tasks SET parent_task_id = $1 WHERE id = $2;`;
          await db.query(updateQ, [newParentId, newTaskId]);
        }
      }
    }

    // Pass 3: assignees, dependencies, recurrence (only when present on payload)
    const tasksWithCptId = body
      .filter((task) => task.id && taskIdMap.get(task.id))
      .map((task) => ({ task, cptTaskId: taskIdMap.get(task.id as string) as string }));

    for (const batch of chunkArray(tasksWithCptId, 20)) {
      await Promise.all(
        batch.map(async ({ task, cptTaskId }) => {
          if (task.assignees?.length) {
            await this.insertCustomTemplateTaskAssignees(cptTaskId, task.assignees);
          }

          if (task.dependencies?.length) {
            await this.insertCustomTemplateTaskDependencies(
              cptTaskId,
              task.dependencies,
              taskIdMap
            );
          }

          if (task.recurrence) {
            const scheduleId = await this.insertCustomTemplateTaskRecurrence(
              template_id,
              task.recurrence
            );
            if (scheduleId) {
              await db.query(`UPDATE cpt_tasks SET schedule_id = $1 WHERE id = $2;`, [
                scheduleId,
                cptTaskId,
              ]);
            }
          }
        })
      );
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskAssignees(
    task_id: string,
    assignees: ICustomTemplateTaskAssignee[]
  ) {
    const rows = assignees.filter((assignee) => assignee.team_member_id);
    if (!rows.length) return;

    const values: unknown[] = [];
    const placeholders = rows.map((assignee, i) => {
      const base = i * 4;
      values.push(task_id, assignee.team_member_id, assignee.email || null, assignee.name || null);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });
    await db.query(
      `INSERT INTO cpt_task_assignees (task_id, team_member_id, email, name)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (task_id, team_member_id) DO NOTHING;`,
      values
    );
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskDependencies(
    task_id: string,
    dependencies: ICustomTemplateTaskDependency[],
    taskIdMap: Map<string, string>
  ) {
    const rows = dependencies
      .map((dep) => ({
        relatedCptId: taskIdMap.get(dep.related_task_id),
        dependencyType: dep.dependency_type || "blocked_by",
      }))
      .filter((row) => row.relatedCptId && row.relatedCptId !== task_id);
    if (!rows.length) return;

    const values: unknown[] = [];
    const placeholders = rows.map((row, i) => {
      const base = i * 3;
      values.push(task_id, row.relatedCptId, row.dependencyType);
      return `($${base + 1}, $${base + 2}, COALESCE($${base + 3}::DEPENDENCY_TYPE, 'blocked_by'::DEPENDENCY_TYPE))`;
    });
    await db.query(
      `INSERT INTO cpt_task_dependencies (task_id, related_task_id, dependency_type)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (task_id, related_task_id, dependency_type) DO NOTHING;`,
      values
    );
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskRecurrence(
    template_id: string,
    recurrence: ICustomTemplateTaskRecurrence
  ): Promise<string | null> {
    if (!recurrence.schedule_type) return null;

    const q = `
      INSERT INTO cpt_task_recurring_schedules (
        template_id, schedule_type, days_of_week, day_of_month, date_of_month, week_of_month,
        interval_days, interval_weeks, interval_months, end_offset_days, max_occurrences,
        recurring_mode, target_status_name, timezone_name
      ) VALUES (
        $1, $2::SCHEDULE_TYPE, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14
      )
      RETURNING id;
    `;
    const result = await db.query(q, [
      template_id,
      recurrence.schedule_type,
      recurrence.days_of_week || null,
      recurrence.day_of_month ?? null,
      recurrence.date_of_month ?? null,
      recurrence.week_of_month ?? null,
      recurrence.interval_days ?? null,
      recurrence.interval_weeks ?? null,
      recurrence.interval_months ?? null,
      recurrence.end_offset_days ?? null,
      recurrence.max_occurrences ?? null,
      recurrence.recurring_mode === "change_status" ? "change_status" : "create_task",
      recurrence.target_status_name || null,
      recurrence.timezone_name || "UTC",
    ]);
    return result.rows[0]?.id || null;
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskPhases(
    task_id: string,
    template_id: string,
    phase_name = "",
  ) {
    const q = `INSERT INTO cpt_task_phases (task_id, phase_id)
                VALUES ($1, (SELECT id FROM cpt_phases WHERE template_id = $2 AND name = $3));`;
    await db.query(q, [task_id, template_id, phase_name]);
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskLabels(
    task_id: string,
    labels: IProjectTemplateLabel[],
    team_id: string,
  ) {
    for await (const label of labels) {
      const q = `INSERT INTO cpt_task_labels(task_id, label_id)
                VALUES ($1, (SELECT id FROM team_labels WHERE name = $2 AND team_id = $3));`;
      await db.query(q, [task_id, label.name, team_id]);
    }
  }

  @HandleExceptions()
  protected static async updateTeamName(
    name: string,
    team_id: string,
    user_id: string,
  ) {
    const q = `UPDATE teams SET name = TRIM($1::TEXT) WHERE id = $2 AND user_id = $3;`;
    const result = await db.query(q, [name, team_id, user_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async deleteDefaultStatusForProject(task_id: string) {
    const q = `DELETE FROM task_statuses WHERE project_id = $1;`;
    await db.query(q, [task_id]);
  }

  @HandleExceptions()
  protected static async handleAccountSetup(
    project_id: string,
    user_id: string,
    team_name: string,
  ) {
    // update user setup status
    await db.query(`UPDATE users SET setup_completed = TRUE WHERE id = $1;`, [
      user_id,
    ]);

    await db.query(
      `INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                            trial_expire_date, subscription_status)
                        VALUES ($1, TRIM($2::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '14 days', 'trialing')
                        ON CONFLICT (user_id) DO UPDATE SET organization_name = TRIM($2::TEXT);`,
      [user_id, team_name],
    );
  }

  /**
   * Creates project tasks from a custom template.
   *
   * Plan/structure only — never copies activity:
   * logged time (task_work_log), running timers, comments, attachments,
   * task history/activity logs, or source progress_value.
   * Done-category tasks get progress_value=100 from their status category after insert
   * (structural, not copied from the source project).
   *
   * Phase 6: also applies assignees, dependencies, and recurrence when present on
   * the task payload (loaded from CPT tables). Returns skips for partial failures.
   */
  protected static async insertProjectTasksFromCustom(
    tasks: IProjectTemplateTask[],
    team_id: string,
    project_id = "",
    user_id = "",
    socket: Socket | null,
    projectStartDate?: string | Date | null,
    taskIncludes?: ITaskIncludes | null,
  ): Promise<IProjectTemplateApplySkip[]> {
    const skips: IProjectTemplateApplySkip[] = [];
    if (!project_id) return skips;

    try {
      // Two-pass approach to handle nested subtasks (3+ levels):
      // Pass 1: Insert all tasks without parent_task_id, storing mapping for later
      // Pass 2: Update parent_task_id relationships using the mapping

      const templateIdToNewIdMap: Map<string, string> = new Map();
      const tasksWithParent: Array<{
        newId: string;
        parentTemplateId: string;
      }> = [];

      // Pass 1: Insert all tasks without parent relationships
      for await (const [key, task] of tasks.entries()) {
        const totalMinutesValue = normalizeTotalMinutes(task.total_minutes);
        const descriptionValue =
          task.description === undefined ? null : task.description;

        const startDate =
          projectStartDate != null && projectStartDate !== ""
            ? applyOffsetDate(projectStartDate, task.start_offset_days)
            : null;
        const endDate =
          projectStartDate != null && projectStartDate !== ""
            ? applyOffsetDate(projectStartDate, task.due_offset_days)
            : null;

        const q = `INSERT INTO tasks(name, project_id, status_id, priority_id, reporter_id, sort_order,
                              parent_task_id, description, total_minutes, task_no,
                              status_sort_order, priority_sort_order, phase_sort_order,
                              roadmap_sort_order, member_sort_order,
                              start_date, end_date, billable)
                    VALUES ($1, $2, (SELECT id FROM task_statuses ts WHERE ts.name = $3 AND ts.project_id = $2),
                            (SELECT id FROM task_priorities tp WHERE tp.name = $4), $5, $6,
                            NULL, $7, $8, $9,
                            $10, $11, $12,
                            $13, $14,
                            $15, $16, $17)
                    RETURNING id, status_id;`;

        // Use sequential index (key) for ALL sort orders to ensure deterministic ordering
        // This prevents non-deterministic ordering when importing the same template multiple times
        const sortOrderValue = key;

        const result = await db.query(q, [
          task.name,
          project_id,
          task.status_name,
          task.priority_name,
          user_id,
          sortOrderValue, // $6  sort_order
          descriptionValue, // $7
          totalMinutesValue, // $8
          task.task_no, // $9
          sortOrderValue, // $10 status_sort_order
          sortOrderValue, // $11 priority_sort_order
          sortOrderValue, // $12 phase_sort_order
          sortOrderValue, // $13 roadmap_sort_order
          sortOrderValue, // $14 member_sort_order
          startDate, // $15
          endDate, // $16
          task.billable === undefined || task.billable === null
            ? true
            : Boolean(task.billable), // $17
        ]);
        const [data] = result.rows;

        // Store the mapping from template task ID (original_task_id which is cpt_tasks.id) to newly created task ID
        if (task.original_task_id) {
          templateIdToNewIdMap.set(task.original_task_id, data.id);
        }

        // Track tasks that have parents for Pass 2
        if (task.parent_task_id) {
          tasksWithParent.push({
            newId: data.id,
            parentTemplateId: task.parent_task_id,
          });
        }

        task.id = data.id;

        if (task.phases) {
          for await (const phase of task.phases) {
            await this.insertTaskPhase(
              data.id,
              phase.name as string,
              project_id,
            );
          }
        }

        if (task.labels) {
          for await (const label of task.labels) {
            await this.insertTaskLabel(data.id, label.name as string, team_id);
          }
        }

        if (socket) {
          logStatusChange({
            task_id: data.id,
            socket,
            new_value: data.status_id,
            old_value: null,
          });
        }
      }

      // Pass 2: Update parent_task_id relationships
      for (const { newId, parentTemplateId } of tasksWithParent) {
        const newParentId = templateIdToNewIdMap.get(parentTemplateId);
        if (newParentId) {
          const updateQ = `UPDATE tasks SET parent_task_id = $1 WHERE id = $2;`;
          await db.query(updateQ, [newParentId, newId]);
        }
      }

      // Set progress_value = 100 for all tasks that are in a "Done" status category
      // (derived from status structure — not copied from source project progress)
      const progressUpdateQ = `
        UPDATE tasks
        SET progress_value = 100, manual_progress = TRUE
        WHERE project_id = $1
          AND status_id IN (
            SELECT ts.id
            FROM task_statuses ts
            JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
            WHERE ts.project_id = $1
              AND stsc.is_done IS TRUE
          )
      `;
      await db.query(progressUpdateQ, [project_id]);

      // Phase 6 resolution — gated by includes when present; default on if data exists
      const applyAssignees = taskIncludes?.assignees !== false;
      const applyDependencies = taskIncludes?.dependencies !== false;
      const applyRecurrence = taskIncludes?.recurrence !== false;

      if (applyAssignees) {
        await this.applyImportedTaskAssignees(
          tasks,
          templateIdToNewIdMap,
          project_id,
          team_id,
          user_id,
          skips
        );
      }

      if (applyDependencies) {
        await this.applyImportedTaskDependencies(
          tasks,
          templateIdToNewIdMap,
          skips
        );
      }

      if (applyRecurrence) {
        await this.applyImportedTaskRecurrence(
          tasks,
          templateIdToNewIdMap,
          project_id,
          projectStartDate,
          user_id || null,
          skips
        );
      }
    } catch (error) {
      log_error(error);
      throw error;
    }

    return skips;
  }

  @HandleExceptions()
  protected static async getProjectCustomColumns(
    project_id: string,
  ): Promise<ICustomColumnWithConfig[]> {
    const q = `
      SELECT 
        cc.id,
        cc.name,
        cc.key,
        cc.field_type,
        cc.width,
        cc.is_visible,
        cc.is_custom_column,
        (
          SELECT ROW_TO_JSON(config) 
          FROM (
            SELECT 
              field_title,
              field_type,
              number_type,
              decimals,
              label,
              label_position,
              expression,
              first_numeric_column_key,
              second_numeric_column_key
            FROM cc_column_configurations 
            WHERE column_id = cc.id
          ) config
        ) AS configuration,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(sel))), '[]'::JSON)
          FROM (
            SELECT 
              selection_id,
              selection_name,
              selection_color,
              selection_order
            FROM cc_selection_options
            WHERE column_id = cc.id
            ORDER BY selection_order
          ) sel
        ) AS selection_options,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(lbl))), '[]'::JSON)
          FROM (
            SELECT 
              label_id,
              label_name,
              label_color,
              label_order
            FROM cc_label_options
            WHERE column_id = cc.id
            ORDER BY label_order
          ) lbl
        ) AS label_options
      FROM cc_custom_columns cc
      WHERE cc.project_id = $1
      ORDER BY cc.created_at;
    `;
    const result = await db.query(q, [project_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async insertCustomTemplateColumns(
    columns: ICustomColumnWithConfig[],
    template_id: string,
  ): Promise<void> {
    // First pass: Create all columns and build a key-to-id mapping
    const keyToIdMap: Map<string, string> = new Map();
    const columnsWithIds: Array<{
      columnId: string;
      column: ICustomColumnWithConfig;
    }> = [];

    for (const column of columns) {
      // Insert the custom column
      const columnQuery = `
        INSERT INTO cpt_custom_columns (
          template_id, name, key, field_type, width, 
          is_visible, is_custom_column, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
      `;
      const columnResult = await db.query(columnQuery, [
        template_id,
        column.name,
        column.key,
        column.field_type,
        column.width || 150,
        column.is_visible !== false,
        column.is_custom_column !== false,
        column.sort_order || 0,
      ]);
      const columnId = columnResult.rows[0].id;

      // Store the mapping from key to new template column id
      keyToIdMap.set(column.key, columnId);
      columnsWithIds.push({ columnId, column });
    }

    // Second pass: Insert configurations with resolved column references
    for (const { columnId, column } of columnsWithIds) {
      // Insert column configuration if exists
      if (column.configuration) {
        // Resolve column key references to IDs using the mapping
        let firstNumericColumnId = null;
        let secondNumericColumnId = null;

        if (column.configuration.first_numeric_column_key) {
          firstNumericColumnId =
            keyToIdMap.get(column.configuration.first_numeric_column_key) ||
            null;
        }

        if (column.configuration.second_numeric_column_key) {
          secondNumericColumnId =
            keyToIdMap.get(column.configuration.second_numeric_column_key) ||
            null;
        }

        const configQuery = `
          INSERT INTO cpt_column_configurations (
            column_id, field_title, field_type, number_type, decimals,
            label, label_position, expression, first_numeric_column_id, second_numeric_column_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `;
        await db.query(configQuery, [
          columnId,
          column.configuration.field_title,
          column.configuration.field_type,
          column.configuration.number_type,
          column.configuration.decimals,
          column.configuration.label,
          column.configuration.label_position,
          column.configuration.expression,
          firstNumericColumnId,
          secondNumericColumnId,
        ]);
      }

      // Insert selection options if they exist
      if (column.selection_options && column.selection_options.length > 0) {
        for (const option of column.selection_options) {
          const selectionQuery = `
            INSERT INTO cpt_selection_options (
              column_id, selection_id, selection_name, selection_color, selection_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          await db.query(selectionQuery, [
            columnId,
            option.selection_id,
            option.selection_name,
            option.selection_color,
            option.selection_order,
          ]);
        }
      }

      // Insert label options if they exist
      if (column.label_options && column.label_options.length > 0) {
        for (const option of column.label_options) {
          const labelQuery = `
            INSERT INTO cpt_label_options (
              column_id, label_id, label_name, label_color, label_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          await db.query(labelQuery, [
            columnId,
            option.label_id,
            option.label_name,
            option.label_color,
            option.label_order,
          ]);
        }
      }
    }
  }

  @HandleExceptions()
  protected static async getTemplateCustomColumns(
    template_id: string,
  ): Promise<ICustomColumnWithConfig[]> {
    const q = `
      SELECT 
        cc.id,
        cc.name,
        cc.key,
        cc.field_type,
        cc.width,
        cc.is_visible,
        cc.is_custom_column,
        cc.sort_order,
        (
          SELECT ROW_TO_JSON(config) 
          FROM (
            SELECT 
              field_title,
              field_type,
              number_type,
              decimals,
              label,
              label_position,
              expression,
              first_numeric_column_id,
              second_numeric_column_id
            FROM cpt_column_configurations 
            WHERE column_id = cc.id
          ) config
        ) AS configuration,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(sel))), '[]'::JSON)
          FROM (
            SELECT 
              selection_id,
              selection_name,
              selection_color,
              selection_order
            FROM cpt_selection_options
            WHERE column_id = cc.id
            ORDER BY selection_order
          ) sel
        ) AS selection_options,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(lbl))), '[]'::JSON)
          FROM (
            SELECT 
              label_id,
              label_name,
              label_color,
              label_order
            FROM cpt_label_options
            WHERE column_id = cc.id
            ORDER BY label_order
          ) lbl
        ) AS label_options
      FROM cpt_custom_columns cc
      WHERE cc.template_id = $1
      ORDER BY cc.sort_order, cc.created_at;
    `;
    const result = await db.query(q, [template_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async insertProjectCustomColumns(
    columns: ICustomColumnWithConfig[],
    project_id: string,
  ): Promise<void> {
    for (const column of columns) {
      // Insert the custom column for the new project
      const columnQuery = `
        INSERT INTO cc_custom_columns (
          project_id, name, key, field_type, width, 
          is_visible, is_custom_column
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id;
      `;
      const columnResult = await db.query(columnQuery, [
        project_id,
        column.name,
        column.key,
        column.field_type,
        column.width || 150,
        column.is_visible !== false,
        column.is_custom_column !== false,
      ]);
      const columnId = columnResult.rows[0].id;

      // Insert column configuration if exists
      if (column.configuration) {
        const configQuery = `
          INSERT INTO cc_column_configurations (
            column_id, field_title, field_type, number_type, decimals,
            label, label_position, expression, first_numeric_column_key, second_numeric_column_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `;
        await db.query(configQuery, [
          columnId,
          column.configuration.field_title,
          column.configuration.field_type,
          column.configuration.number_type,
          column.configuration.decimals,
          column.configuration.label,
          column.configuration.label_position,
          column.configuration.expression,
          column.configuration.first_numeric_column_key ||
            column.configuration.first_numeric_column_id,
          column.configuration.second_numeric_column_key ||
            column.configuration.second_numeric_column_id,
        ]);
      }

      // Insert selection options if they exist
      if (column.selection_options && column.selection_options.length > 0) {
        for (const option of column.selection_options) {
          const selectionQuery = `
            INSERT INTO cc_selection_options (
              column_id, selection_id, selection_name, selection_color, selection_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          await db.query(selectionQuery, [
            columnId,
            option.selection_id,
            option.selection_name,
            option.selection_color,
            option.selection_order,
          ]);
        }
      }

      // Insert label options if they exist
      if (column.label_options && column.label_options.length > 0) {
        for (const option of column.label_options) {
          const labelQuery = `
            INSERT INTO cc_label_options (
              column_id, label_id, label_name, label_color, label_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          await db.query(labelQuery, [
            columnId,
            option.label_id,
            option.label_name,
            option.label_color,
            option.label_order,
          ]);
        }
      }
    }
  }

  /**
   * Normalize task rows from getCustomTemplateData / getTemplateData / editor payloads
   * into the shape expected by insertCustomTemplateTasks.
   */
  protected static normalizeTasksForCustomInsert(
    tasks: IProjectTemplateTask[] | null | undefined
  ): IProjectTemplateTask[] {
    if (!Array.isArray(tasks)) return [];

    return tasks.map((task, index) => {
      const id =
        task.id ||
        task.original_task_id ||
        `synthetic-${index}-${(task.name || "task").slice(0, 32)}`;
      const phase_name =
        task.phase_name ||
        (Array.isArray(task.phases) && task.phases[0]?.name) ||
        undefined;

      const resolvedTaskNo =
        task.task_no !== undefined &&
        task.task_no !== null &&
        Number.isFinite(Number(task.task_no))
          ? Number(task.task_no)
          : index + 1;

      return {
        ...task,
        id,
        original_task_id: task.original_task_id || id,
        phase_name,
        task_no: resolvedTaskNo,
        sort_order: task.sort_order ?? index,
        status_sort_order: task.status_sort_order ?? index,
        priority_sort_order: task.priority_sort_order ?? index,
        phase_sort_order: task.phase_sort_order ?? index,
      };
    });
  }

  protected static normalizeStatusesForCustomInsert(
    statuses: IProjectTemplateStatus[] | null | undefined
  ): IProjectTemplateStatus[] {
    if (!Array.isArray(statuses)) return [];
    return statuses.map((status, index) => ({
      ...status,
      sort_order:
        status.sort_order !== undefined && status.sort_order !== null
          ? status.sort_order
          : String(index),
    }));
  }

  /** Resolve a default todo category when a status payload omits category_id. */
  protected static async resolveDefaultStatusCategoryId(): Promise<string | null> {
    const result = await db.query(
      `SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE LIMIT 1;`
    );
    return result.rows[0]?.id || null;
  }

  protected static async listCustomTemplateNames(
    teamId: string
  ): Promise<string[]> {
    const result = await db.query(
      `SELECT name FROM custom_project_templates WHERE team_id = $1;`,
      [teamId]
    );
    return result.rows.map((row: { name: string }) => row.name);
  }

  protected static async clearCustomTemplateChildren(
    templateId: string
  ): Promise<void> {
    await db.query(
      `UPDATE cpt_tasks SET schedule_id = NULL WHERE template_id = $1;`,
      [templateId]
    );
    await db.query(
      `DELETE FROM cpt_task_recurring_schedules WHERE template_id = $1;`,
      [templateId]
    );
    await db.query(`DELETE FROM cpt_rate_card_roles WHERE template_id = $1;`, [
      templateId,
    ]);
    await db.query(`DELETE FROM cpt_tasks WHERE template_id = $1;`, [
      templateId,
    ]);
    await db.query(`DELETE FROM cpt_task_statuses WHERE template_id = $1;`, [
      templateId,
    ]);
    await db.query(`DELETE FROM cpt_phases WHERE template_id = $1;`, [
      templateId,
    ]);
    await db.query(`DELETE FROM cpt_custom_columns WHERE template_id = $1;`, [
      templateId,
    ]);
  }

  /**
   * Persist phases, statuses, tasks, labels, settings extras onto an existing
   * custom template row (children only — header must already exist).
   */
  protected static async persistCustomTemplateChildren(
    templateId: string,
    teamId: string,
    definition: {
      phases?: ICustomTemplatePhase[] | IProjectTemplatePhase[] | null;
      status?: IProjectTemplateStatus[] | null;
      labels?: IProjectTemplateLabel[] | null;
      tasks?: IProjectTemplateTask[] | null;
      includes?: IProjectTemplateIncludesPayload | null;
      settings?: IProjectTemplateSettingsSnapshot | null;
      include_custom_columns?: boolean;
      custom_columns?: ICustomColumnWithConfig[] | null;
    }
  ): Promise<void> {
    const phases = Array.isArray(definition.phases) ? definition.phases : [];
    let statuses = this.normalizeStatusesForCustomInsert(definition.status);
    const tasks = this.normalizeTasksForCustomInsert(definition.tasks);
    const labels = Array.isArray(definition.labels) ? definition.labels : [];
    const includes = definition.includes || {};
    const settings = definition.settings || null;

    if (statuses.some((status) => !status.category_id)) {
      const fallbackCategoryId = await this.resolveDefaultStatusCategoryId();
      if (fallbackCategoryId) {
        statuses = statuses.map((status) => ({
          ...status,
          category_id: status.category_id || fallbackCategoryId,
        }));
      }
    }

    await db.query(
      `UPDATE custom_project_templates
       SET schema_version = COALESCE(schema_version, 1),
           includes = COALESCE($2::jsonb, includes),
           settings = COALESCE($3::jsonb, settings),
           include_custom_columns = COALESCE($4, include_custom_columns),
           updated_at = NOW()
       WHERE id = $1;`,
      [
        templateId,
        includes && Object.keys(includes).length
          ? JSON.stringify(includes)
          : null,
        settings ? JSON.stringify(settings) : null,
        definition.include_custom_columns ?? null,
      ]
    );

    if (labels.length) {
      await this.insertTeamLabels(labels, teamId);
    }
    if (phases.length) {
      await this.insertCustomTemplatePhases(
        phases as ICustomTemplatePhase[],
        templateId
      );
    }
    if (statuses.length) {
      await this.insertCustomTemplateStatus(statuses, templateId, teamId);
    }
    if (tasks.length) {
      await this.insertCustomTemplateTasks(tasks, templateId, teamId);
    }

    const rateCard = settings?.budget?.rate_card;
    if (Array.isArray(rateCard) && rateCard.length) {
      await this.insertTemplateRateCardRoles(templateId, rateCard);
    }

    const customColumns = Array.isArray(definition.custom_columns)
      ? definition.custom_columns
      : null;
    if (customColumns?.length) {
      await this.insertCustomTemplateColumns(customColumns, templateId);
      await db.query(
        `UPDATE custom_project_templates SET include_custom_columns = TRUE WHERE id = $1;`,
        [templateId]
      );
    }
  }

  /**
   * Create a new custom template shell + children from a full definition.
   * Returns the new template id.
   */
  protected static async createCustomTemplateFromDefinition(
    teamId: string,
    definition: {
      name: string;
      phase_label?: string | null;
      color_code?: string | null;
      notes?: string | null;
      phases?: ICustomTemplatePhase[] | IProjectTemplatePhase[] | null;
      status?: IProjectTemplateStatus[] | null;
      labels?: IProjectTemplateLabel[] | null;
      tasks?: IProjectTemplateTask[] | null;
      includes?: IProjectTemplateIncludesPayload | null;
      settings?: IProjectTemplateSettingsSnapshot | null;
      include_custom_columns?: boolean;
      custom_columns?: ICustomColumnWithConfig[] | null;
      schema_version?: number;
    }
  ): Promise<string> {
    const shell = {
      name: definition.name.trim(),
      phase_label: definition.phase_label || "Phase",
      color_code: definition.color_code || getColor(definition.name),
      notes: definition.notes || null,
      team_id: teamId,
    };

    const result = await db.query(`SELECT create_project_template($1);`, [
      JSON.stringify(shell),
    ]);
    const templateId = result.rows[0]?.create_project_template?.id as string;
    if (!templateId) {
      throw new Error("Failed to create custom project template.");
    }

    const defaultIncludes: IProjectTemplateIncludesPayload = {
      project: {
        statuses: true,
        phases: true,
        labels: true,
        customColumns: Boolean(definition.include_custom_columns),
      },
      projectSettings: {
        category: false,
        projectManager: false,
        estimatedWorkingDays: false,
        estimatedManDays: false,
        hoursPerDay: false,
        advanced: false,
        budget: false,
      },
      task: {
        status: true,
        phase: true,
        labels: true,
        estimation: true,
        description: true,
        subtasks: true,
        assignees: true,
        recurrence: true,
        dependencies: true,
        billable: true,
        dateOffsets: true,
      },
    };

    await db.query(
      `UPDATE custom_project_templates
       SET schema_version = $2,
           includes = $3::jsonb,
           settings = $4::jsonb,
           updated_at = NOW()
       WHERE id = $1;`,
      [
        templateId,
        definition.schema_version ?? CUSTOM_PROJECT_TEMPLATE_SCHEMA_VERSION,
        JSON.stringify(definition.includes || defaultIncludes),
        JSON.stringify(definition.settings || {}),
      ]
    );

    await this.persistCustomTemplateChildren(templateId, teamId, {
      phases: definition.phases,
      status: definition.status,
      labels: definition.labels,
      tasks: definition.tasks,
      includes: definition.includes || defaultIncludes,
      settings: definition.settings,
      include_custom_columns: definition.include_custom_columns,
      custom_columns: definition.custom_columns,
    });

    return templateId;
  }

  /**
   * Map a worklenz (built-in) template payload into a custom-template definition.
   */
  protected static async buildDefinitionFromWorklenzTemplate(
    worklenzTemplateId: string,
    overrides?: {
      name?: string;
      phase_label?: string;
      color_code?: string;
      notes?: string;
      phases?: IProjectTemplatePhase[];
      status?: IProjectTemplateStatus[];
      labels?: IProjectTemplateLabel[];
      tasks?: IProjectTemplateTask[];
      includes?: IProjectTemplateIncludesPayload;
      settings?: IProjectTemplateSettingsSnapshot;
    }
  ): Promise<{
    name: string;
    phase_label?: string | null;
    color_code?: string | null;
    notes?: string | null;
    phases?: IProjectTemplatePhase[];
    status?: IProjectTemplateStatus[];
    labels?: IProjectTemplateLabel[];
    tasks?: IProjectTemplateTask[];
    includes?: IProjectTemplateIncludesPayload;
    settings?: IProjectTemplateSettingsSnapshot | null;
  } | null> {
    const data = await this.getTemplateData(worklenzTemplateId);
    if (!data) return null;

    return {
      name: (overrides?.name || data.name || "Template").trim(),
      phase_label: overrides?.phase_label ?? data.phase_label ?? "Phase",
      color_code:
        overrides?.color_code ||
        data.color_code ||
        getColor(data.name || "Template"),
      notes: overrides?.notes ?? data.description ?? null,
      phases: overrides?.phases ?? data.phases ?? [],
      status: overrides?.status ?? data.status ?? [],
      labels: overrides?.labels ?? data.labels ?? [],
      tasks: overrides?.tasks ?? data.tasks ?? [],
      includes: overrides?.includes,
      settings: overrides?.settings ?? null,
    };
  }
}
