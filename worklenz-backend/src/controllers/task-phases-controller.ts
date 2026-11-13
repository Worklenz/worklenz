import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {TASK_STATUS_COLOR_ALPHA} from "../shared/constants";
import {IO} from "../shared/io";
import {isValidUuid} from "../shared/validation-helpers";
import {SocketEvents} from "../socket.io/events";
import {
  completeSprintRecord,
  getSprintLengthDays,
  startSprintRecord,
  tryStartNextSprintAfterCompletion,
} from "../shared/sprint-lifecycle";

export default class TaskPhasesController extends WorklenzControllerBase {
  private static readonly DEFAULT_PHASE_COLOR = "#fbc84c";
  private static readonly SPRINT_GOAL_MAX_LENGTH = 500;
  private static readonly PHASE_RETURNING_COLUMNS =
    "id, name, color_code, start_date, end_date, sprint_status, sprint_goal, sort_index";

  /** Normalizes an optional sprint goal: trimmed text, or null when empty. */
  private static parseSprintGoal(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.query.id)
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

    // Use custom name if provided, otherwise use default naming pattern
    const phaseName = req.body.name?.trim() || 
      `Untitled Phase (${(await db.query("SELECT COUNT(*) FROM project_phases WHERE project_id = $1", [req.query.id])).rows[0].count + 1})`;

    const sprintGoal = this.parseSprintGoal(req.body.sprint_goal);
    if (sprintGoal && sprintGoal.length > this.SPRINT_GOAL_MAX_LENGTH) {
      return res.status(400).send(new ServerResponse(false, null, "Sprint goal is too long"));
    }

    const q = `
        INSERT INTO project_phases (name, color_code, project_id, sort_index, start_date, end_date, sprint_status, sprint_goal)
        VALUES (
                $1,
                $2,
                $3,
                (SELECT COUNT(*) FROM project_phases WHERE project_id = $3) + 1,
                $4::TIMESTAMPTZ,
                $5::TIMESTAMPTZ,
                COALESCE(NULLIF($6::TEXT, ''), 'planned'),
                $7)
        RETURNING ${this.PHASE_RETURNING_COLUMNS};
    `;

    req.body.color_code = this.DEFAULT_PHASE_COLOR;

    const sprintStatus =
      req.body.sprint_status === "active" || req.body.sprint_status === "completed"
        ? req.body.sprint_status
        : "planned";

    const result = await db.query(q, [
      phaseName,
      req.body.color_code,
      req.query.id,
      req.body.start_date || null,
      req.body.end_date || null,
      sprintStatus,
      sprintGoal,
    ]);
    const [data] = result.rows;

    // Return the stored color with alpha appended — same as the GET endpoint —
    // so the modal and the task list always show the same color for a new phase.
    data.color_code = data.color_code + TASK_STATUS_COLOR_ALPHA;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT
        pp.id,
        pp.name,
        pp.color_code,
        pp.default_assignee_id,
        pp.start_date,
        pp.end_date,
        pp.sprint_status,
        pp.sprint_goal,
        (SELECT COUNT(*) FROM task_phase WHERE phase_id = pp.id) AS usage,
        -- Issues moved into the active sprint after it started (scope change)
        CASE
          WHEN pp.sprint_status = 'active' AND pp.start_date IS NOT NULL THEN (
            SELECT COUNT(DISTINCT tp.task_id)
            FROM task_phase tp
            INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE
            WHERE tp.phase_id = pp.id
              AND EXISTS (
                SELECT 1
                FROM task_activity_logs tal
                WHERE tal.task_id = tp.task_id
                  AND tal.attribute_type = 'phase'
                  AND tal.new_value = pp.id::TEXT
                  AND tal.created_at > pp.start_date
              )
          )
          ELSE 0
        END::INT AS scope_added_count,
        sprint_metrics.issue_count,
        sprint_metrics.done_issue_count,
        sprint_metrics.total_points,
        sprint_metrics.done_points,
        sprint_metrics.blocked_issue_count,
        sprint_metrics.high_priority_open_count,
        (SELECT tmiv.name
           FROM team_member_info_view tmiv
          WHERE tmiv.team_member_id = pp.default_assignee_id
          LIMIT 1) AS default_assignee_name,
        (SELECT tmiv.avatar_url
           FROM team_member_info_view tmiv
          WHERE tmiv.team_member_id = pp.default_assignee_id
          LIMIT 1) AS default_assignee_avatar_url
      FROM project_phases pp
      -- Active sprint health metrics. "Blocked" is the status seeded for software projects;
      -- high priority means task_priorities.value >= 2 (High, Critical).
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::INT AS issue_count,
          COUNT(*) FILTER (WHERE stsc.is_done IS TRUE)::INT AS done_issue_count,
          COALESCE(SUM(t.story_points), 0)::FLOAT AS total_points,
          COALESCE(SUM(t.story_points) FILTER (WHERE stsc.is_done IS TRUE), 0)::FLOAT AS done_points,
          COUNT(*) FILTER (WHERE LOWER(ts.name) = 'blocked')::INT AS blocked_issue_count,
          COUNT(*) FILTER (WHERE tpr.value >= 2 AND stsc.is_done IS NOT TRUE)::INT AS high_priority_open_count
        FROM task_phase tp
        INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE
        LEFT JOIN task_statuses ts ON ts.id = t.status_id
        LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
        LEFT JOIN task_priorities tpr ON tpr.id = t.priority_id
        WHERE tp.phase_id = pp.id
          AND pp.sprint_status = 'active'
      ) sprint_metrics ON TRUE
      WHERE pp.project_id = $1
      ORDER BY
        CASE COALESCE(pp.sprint_status, 'planned')
          WHEN 'active' THEN 0
          WHEN 'planned' THEN 1
          WHEN 'completed' THEN 2
          ELSE 3
        END,
        pp.sort_index DESC;
    `;
    const result = await db.query(q, [req.query.id]);

    for (const phase of result.rows)
      phase.color_code = phase.color_code + TASK_STATUS_COLOR_ALPHA;

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateDefaultAssignee(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // default_assignee_id can be null to clear the assignee
    const defaultAssigneeId = typeof req.body.default_assignee_id === "string"
      ? req.body.default_assignee_id.trim() || null
      : req.body.default_assignee_id || null;

    if (defaultAssigneeId && !isValidUuid(defaultAssigneeId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid phase assignee"));
    }

    const q = `
      UPDATE project_phases
      SET default_assignee_id = $3
      FROM projects p
      WHERE project_phases.id = $1
        AND project_phases.project_id = $2
        AND p.id = project_phases.project_id
        AND (
          $3::UUID IS NULL
          OR EXISTS (
            SELECT 1
            FROM project_members pm
            JOIN team_members tm ON tm.id = pm.team_member_id
            WHERE pm.project_id = project_phases.project_id
              AND pm.team_member_id = $3::UUID
              AND tm.team_id = p.team_id
          )
        )
      RETURNING
        project_phases.id,
        project_phases.name,
        project_phases.color_code,
        project_phases.default_assignee_id,
        (SELECT tmiv.name
           FROM team_member_info_view tmiv
          WHERE tmiv.team_member_id = project_phases.default_assignee_id
          LIMIT 1) AS default_assignee_name,
        (SELECT tmiv.avatar_url
           FROM team_member_info_view tmiv
          WHERE tmiv.team_member_id = project_phases.default_assignee_id
          LIMIT 1) AS default_assignee_avatar_url;
    `;

    const result = await db.query(q, [req.params.id, req.query.id, defaultAssigneeId]);
    const [data] = result.rows;

    if (!data) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid phase assignee"));
    }

    if (data?.color_code) {
      data.color_code = data.color_code + TASK_STATUS_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(req.body, key);
    const hasDates = hasOwn("start_date") || hasOwn("end_date");
    const hasGoal = hasOwn("sprint_goal");

    if (hasDates && req.body.start_date && req.body.end_date
      && new Date(req.body.end_date).getTime() < new Date(req.body.start_date).getTime()) {
      return res.status(400).send(new ServerResponse(false, null, "End date cannot be before start date"));
    }

    const sprintGoal = this.parseSprintGoal(req.body.sprint_goal);
    if (sprintGoal && sprintGoal.length > this.SPRINT_GOAL_MAX_LENGTH) {
      return res.status(400).send(new ServerResponse(false, null, "Sprint goal is too long"));
    }

    const q = `
      UPDATE project_phases
      SET name = COALESCE(NULLIF(TRIM($3), ''), name),
          start_date = CASE WHEN $4::BOOLEAN THEN $5::TIMESTAMPTZ ELSE start_date END,
          end_date = CASE WHEN $4::BOOLEAN THEN $6::TIMESTAMPTZ ELSE end_date END,
          sprint_goal = CASE WHEN $7::BOOLEAN THEN $8 ELSE sprint_goal END
      WHERE id = $1
        AND project_id = $2
      RETURNING ${this.PHASE_RETURNING_COLUMNS};
    `;

    const result = await db.query(q, [
      req.params.id,
      req.query.id,
      typeof req.body.name === "string" ? req.body.name : "",
      hasDates,
      req.body.start_date || null,
      req.body.end_date || null,
      hasGoal,
      sprintGoal,
    ]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateColor(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Sanitize color code to ensure it matches the database constraint
    let colorCode = req.body.color_code || this.DEFAULT_PHASE_COLOR;
    
    // Extract only the hex color part (first 7 characters: #RRGGBB)
    // This removes any alpha channel or extra characters
    if (colorCode.startsWith('#')) {
      colorCode = colorCode.substring(0, 7);
    }
    
    // Validate the color format matches #RRGGBB or #RGB
    const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    
    if (!hexColorRegex.test(colorCode)) {
      // If invalid, use default color
      colorCode = this.DEFAULT_PHASE_COLOR;
    }
    
    // Convert to lowercase to ensure consistency
    colorCode = colorCode.toLowerCase();

    const q = `
      UPDATE project_phases SET color_code = $3 WHERE id = $1 AND project_id = $2 RETURNING id, name, color_code;
    `;

    const result = await db.query(q, [req.params.id, req.query.id, colorCode]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        UPDATE projects
        SET phase_label = $2
        WHERE id = $1;
    `;
    const result = await db.query(q, [req.params.id, req.body.name.trim()]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateSprintSettings(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const autoArchive = req.body?.auto_archive_on_sprint_complete;
    const autoSchedule = req.body?.auto_start_complete_sprints;
    const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";
    if (!isOptionalBoolean(autoArchive) || !isOptionalBoolean(autoSchedule)
      || (autoArchive === undefined && autoSchedule === undefined)) {
      return res.status(400).send(new ServerResponse(
        false,
        null,
        "auto_archive_on_sprint_complete and auto_start_complete_sprints must be booleans"
      ));
    }

    const q = `
        UPDATE projects
        SET auto_archive_on_sprint_complete = COALESCE($2, auto_archive_on_sprint_complete),
            auto_start_complete_sprints = COALESCE($4, auto_start_complete_sprints)
        WHERE id = $1
          AND team_id = $3
          AND project_type = 'software'
        RETURNING id, auto_archive_on_sprint_complete, auto_start_complete_sprints;
    `;
    const result = await db.query(q, [
      req.params.id,
      autoArchive ?? null,
      req.user?.team_id,
      autoSchedule ?? null,
    ]);
    const [data] = result.rows;
    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Software project not found"));
    }
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateSortOrder (req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const body = {
      phases: req.body.phases.reverse(),
      project_id: req.body.project_id
    };

    const q = `SELECT handle_phase_sort_order($1);`;
    const result = await db.query(q, [JSON.stringify(body)]);
    const [data] = result.rows;

    // ST-5: Log phase reorder to audit trail
    await this.logPhaseReorder(req, body);

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async logPhaseReorder(req: IWorkLenzRequest, body: any): Promise<void> {
    try {
      const projectId = body.project_id;
      const userId = (req as any).user?.id;
      const teamId = (req as any).user?.team_id;

      if (!projectId || !userId || !teamId) {
        console.warn('ST-5: Missing required fields for phase reorder logging');
        return;
      }

      // Get old phase order before update (phases in body are already reversed for display)
      const oldOrderQuery = `
        SELECT json_agg(json_build_object(
          'id', id,
          'name', name,
          'sort_index', sort_index
        ) ORDER BY sort_index DESC) as phases
        FROM project_phases
        WHERE project_id = $1;
      `;
      const oldOrderResult = await db.query(oldOrderQuery, [projectId]);
      const oldPhases = oldOrderResult.rows[0]?.phases || [];

      // New phases are already in body.phases
      const newPhases = body.phases.map((p: any) => ({
        id: p.id,
        name: p.name,
        sort_index: p.sort_index
      }));

      // Get project name for better readability
      const projectNameQuery = `SELECT name FROM projects WHERE id = $1`;
      const projectNameResult = await db.query(projectNameQuery, [projectId]);
      const projectName = projectNameResult.rows[0]?.name || 'Unknown Project';

      // Get user name for the log
      const userNameQuery = `SELECT name FROM users WHERE id = $1`;
      const userNameResult = await db.query(userNameQuery, [userId]);
      const userName = userNameResult.rows[0]?.name || 'Unknown User';

      // Create audit log entry
      const auditLogQuery = `
        INSERT INTO project_logs (team_id, project_id, description, created_at)
        VALUES ($1, $2, $3, NOW());
      `;

      const description = JSON.stringify({
        action: 'PHASE_REORDER',
        user: userName,
        user_id: userId,
        project: projectName,
        timestamp: new Date().toISOString(),
        old_order: oldPhases,
        new_order: newPhases,
        change_summary: `Phases reordered by ${userName}`
      });

      await db.query(auditLogQuery, [teamId, projectId, description]);
      console.log(`[ST-5] Phase reorder logged for project ${projectId} by user ${userId}`);
    } catch (err) {
      console.error('[ST-5] Error logging phase reorder:', err);
      // Don't throw - logging failure shouldn't block the reorder operation
    }
  }

  @HandleExceptions()
  public static async startSprint(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.query.id) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const result = await startSprintRecord(req.query.id as string, req.params.id);
    if (!result.ok) {
      return res.status(400).send(new ServerResponse(false, null, result.error));
    }

    IO.emitToProjectRoom(req.query.id as string, SocketEvents.PROJECT_SPRINTS_UPDATED);
    const data = result.data;
    data.color_code = data.color_code + TASK_STATUS_COLOR_ALPHA;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async completeSprint(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.query.id) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const projectId = req.query.id as string;
    const phaseId = req.params.id;
    // destination: null/'backlog' → remove phase assignment; UUID → move to that planned sprint
    const destinationRaw = (req.body?.destination_phase_id ?? "backlog") as string;
    const destinationPhaseId =
      !destinationRaw || destinationRaw === "backlog" || destinationRaw === "Unmapped"
        ? null
        : destinationRaw;

    const result = await completeSprintRecord(projectId, phaseId, destinationPhaseId);
    if (!result.ok) {
      return res.status(400).send(new ServerResponse(false, null, result.error));
    }

    const {phase, archivedCount, movedCount, plannedLengthDays} = result.data;

    const startedSprint = await tryStartNextSprintAfterCompletion(
      projectId, destinationPhaseId, plannedLengthDays ?? getSprintLengthDays(phase)
    );
    if (startedSprint) startedSprint.color_code = startedSprint.color_code + TASK_STATUS_COLOR_ALPHA;

    IO.emitToProjectRoom(projectId, SocketEvents.PROJECT_SPRINTS_UPDATED);
    phase.color_code = phase.color_code + TASK_STATUS_COLOR_ALPHA;
    return res.status(200).send(
      new ServerResponse(true, {
        ...phase,
        archived_count: archivedCount,
        moved_count: movedCount,
        destination_phase_id: destinationPhaseId,
        started_sprint: startedSprint,
      })
    );
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      DELETE
      FROM project_phases
      WHERE id = $1
        AND project_id = $2
      RETURNING id
    `;
    const result = await db.query(q, [req.params.id, req.query.id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }
}
