import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {TASK_STATUS_COLOR_ALPHA} from "../shared/constants";
import {isValidUuid} from "../shared/validation-helpers";

export default class TaskPhasesController extends WorklenzControllerBase {
  private static readonly DEFAULT_PHASE_COLOR = "#fbc84c";

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.query.id)
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

    // Use custom name if provided, otherwise use default naming pattern
    const phaseName = req.body.name?.trim() || 
      `Untitled Phase (${(await db.query("SELECT COUNT(*) FROM project_phases WHERE project_id = $1", [req.query.id])).rows[0].count + 1})`;

    const q = `
        INSERT INTO project_phases (name, color_code, project_id, sort_index)
        VALUES (
                $1,
                $2,
                $3,
                (SELECT COUNT(*) FROM project_phases WHERE project_id = $3) + 1)
        RETURNING id, name, color_code, sort_index;
    `;

    req.body.color_code = this.DEFAULT_PHASE_COLOR;

    const result = await db.query(q, [phaseName, req.body.color_code, req.query.id]);
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
        (SELECT COUNT(*) FROM task_phase WHERE phase_id = pp.id) AS usage,
        (SELECT tmiv.name
           FROM team_member_info_view tmiv
          WHERE tmiv.team_member_id = pp.default_assignee_id
          LIMIT 1) AS default_assignee_name,
        (SELECT tmiv.avatar_url
           FROM team_member_info_view tmiv
          WHERE tmiv.team_member_id = pp.default_assignee_id
          LIMIT 1) AS default_assignee_avatar_url
      FROM project_phases pp
      WHERE pp.project_id = $1
      ORDER BY pp.sort_index DESC;
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
    const q = `
      UPDATE project_phases
      SET name = $3
      WHERE id = $1
        AND project_id = $2
      RETURNING id, name, color_code;
    `;

    const result = await db.query(q, [req.params.id, req.query.id, req.body.name.trim()]);
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
