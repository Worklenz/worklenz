import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {TASK_PRIORITY_COLOR_ALPHA, WorklenzColorCodes, WorklenzColorShades} from "../shared/constants";

export default class LabelsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      WITH lbs AS (SELECT id,
                          name,
                          color_code,
                          (SELECT COUNT(*) FROM task_labels WHERE label_id = team_labels.id) AS usage,
                          EXISTS(SELECT 1
                                 FROM task_labels
                                 WHERE task_labels.label_id = team_labels.id
                                   AND EXISTS(SELECT 1
                                              FROM tasks
                                              WHERE id = task_labels.task_id
                                                AND project_id = $2)) AS used
                   FROM team_labels
                   WHERE team_id = $1
                   ORDER BY name)
      SELECT id, name, color_code, usage
      FROM lbs
      ORDER BY used DESC;
    `;
    const result = await db.query(q, [req.user?.team_id, req.query.project || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getByTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT (SELECT name FROM team_labels WHERE id = task_labels.label_id),
             (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
      FROM task_labels
      WHERE task_id = $1;
    `;
    const result = await db.query(q, [req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id, name, color_code
      FROM team_labels
      WHERE team_id = $2
        AND EXISTS(SELECT 1
                   FROM tasks
                   WHERE project_id = $1
                     AND EXISTS(SELECT 1 FROM task_labels WHERE task_id = tasks.id AND label_id = team_labels.id))
      ORDER BY name;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id]);

    for (const label of result.rows) {
      label.color_code = label.color_code + TASK_PRIORITY_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
  const { name, color } = req.body;

  if (!name || !name.trim())
    return res.status(400).send(new ServerResponse(false, null, "Label name is required"));

  const validColors = [
    ...Object.keys(WorklenzColorShades),
    ...Object.values(WorklenzColorShades).flat(),
  ].map(c => c.toLowerCase());

  if (!color || !validColors.includes(color.toLowerCase()))
    return res.status(400).send(new ServerResponse(false, null, "Invalid color"));

  const q = `
    INSERT INTO team_labels (name, color_code, team_id)
    VALUES ($1, $2, $3)
    RETURNING id, name, color_code;
  `;
  const result = await db.query(q, [name.trim(), color, req.user?.team_id]);
  return res.status(200).send(new ServerResponse(true, result.rows[0]));
}

  @HandleExceptions()
  public static async updateColor(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE team_labels
               SET color_code = $3
               WHERE id = $1
                 AND team_id = $2;`;

    const validColors = [...Object.keys(WorklenzColorShades), ...Object.values(WorklenzColorShades).flat()].map(c => c.toLowerCase());
    if (!validColors.includes(req.body.color.toLowerCase()))
      return res.status(400).send(new ServerResponse(false, null));

    const result = await db.query(q, [req.params.id, req.user?.team_id, req.body.color]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const updates = [];
    const values = [req.params.id, req.user?.team_id];
    let paramIndex = 3;

    if (req.body.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(req.body.name);
    }

    if (req.body.color) {
      const validColors = [...Object.keys(WorklenzColorShades), ...Object.values(WorklenzColorShades).flat()].map(c => c.toLowerCase());
      if (!validColors.includes(req.body.color.toLowerCase()))
        return res.status(400).send(new ServerResponse(false, {}, "Invalid color"));
      updates.push(`color_code = $${paramIndex++}`);
      values.push(req.body.color);
    }

    if (updates.length === 0) {
      return res.status(400).send(new ServerResponse(false, "No valid fields to update"));
    }

    const q = `UPDATE team_labels
               SET ${updates.join(', ')}
               WHERE id = $1
                 AND team_id = $2;`;

    const result = await db.query(q, values);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const labelId = req.params.id;
    const teamId = req.user?.team_id;
    const forceDelete = req.query.force === 'true'; // Allow force delete to bypass usage check

    // Check if label exists and belongs to team
    const checkQuery = `SELECT id, name FROM team_labels WHERE id = $1 AND team_id = $2;`;
    const checkResult = await db.query(checkQuery, [labelId, teamId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Label not found"));
    }

    const labelName = checkResult.rows[0].name;

    // Check if label is in use by tasks
    const usageQuery = `
      SELECT COUNT(*) as count
      FROM task_labels
      WHERE label_id = $1;
    `;
    const usageResult = await db.query(usageQuery, [labelId]);
    const usageCount = parseInt(usageResult.rows[0]?.count || "0", 10);

    // Check if label is in use by project template tasks
    const ptUsageQuery = `
      SELECT COUNT(*) as count
      FROM cpt_task_labels
      WHERE label_id = $1;
    `;
    const ptUsageResult = await db.query(ptUsageQuery, [labelId]);
    const ptUsageCount = parseInt(ptUsageResult.rows[0]?.count || "0", 10);

    const totalUsage = usageCount + ptUsageCount;

    // If label is in use and not force deleting, return usage information
    if (totalUsage > 0 && !forceDelete) {
      return res.status(200).send(
        new ServerResponse(
          false,
          {
            inUse: true,
            usageCount,
            ptUsageCount,
            totalUsage,
            labelName,
          },
          `This label is currently assigned to ${totalUsage} task${totalUsage > 1 ? 's' : ''}. Deleting it will remove the label from all tasks.`
        )
      );
    }

    // Use a transaction to ensure all deletions happen atomically
    await db.query('BEGIN');
    
    try {
      // Manually delete references from task_labels first
      if (usageCount > 0) {
        await db.query('DELETE FROM task_labels WHERE label_id = $1', [labelId]);
      }
      
      // Manually delete references from cpt_task_labels
      if (ptUsageCount > 0) {
        await db.query('DELETE FROM cpt_task_labels WHERE label_id = $1', [labelId]);
      }
      
      // Now delete the label itself
      const deleteQuery = `DELETE FROM team_labels WHERE id = $1 AND team_id = $2;`;
      const result = await db.query(deleteQuery, [labelId, teamId]);
      
      if (result.rowCount === 0) {
        await db.query('ROLLBACK');
        return res.status(404).send(new ServerResponse(false, null, "Label not found"));
      }
      
      await db.query('COMMIT');
      
      return res.status(200).send(
        new ServerResponse(
          true,
          { deletedCount: totalUsage },
          totalUsage > 0
            ? `Label deleted successfully. Removed from ${totalUsage} task${totalUsage > 1 ? 's' : ''}.`
            : "Label deleted successfully"
        )
      );
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
}
