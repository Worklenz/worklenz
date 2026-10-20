import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {allocateCopyName} from "../shared/template-copy-name";

export default class TasktemplatesController extends WorklenzControllerBase {
  protected static async getTaskTemplateAccess(
    templateId: string | null | undefined,
    teamId: string | null | undefined
  ): Promise<{
    canAccess: boolean;
    canManage: boolean;
    scope: string;
  } | null> {
    if (!templateId || !teamId) return null;

    const q = `
      SELECT
        tt.team_id,
        tt.scope,
        in_organization(tt.team_id, $2) AS in_same_organization
      FROM task_templates tt
      WHERE tt.id = $1
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
    };
  }

  @HandleExceptions({
    raisedExceptions: {
        "TASK_TEMPLATE_EXISTS_ERROR": `A template with the name "{0}" already exists. Please choose a different name.`
    }
})
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {name, tasks} = req.body;
    const q = `SELECT create_task_template($1, $2, $3);`;
    const result = await db.query(q, [name.trim(), req.user?.team_id, JSON.stringify(tasks)]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data, "Task template created successfully"));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT
        tt.id,
        tt.name,
        tt.created_at,
        tt.scope,
        (tt.team_id = $1) AS can_manage
      FROM task_templates tt
      WHERE (
        tt.team_id = $1
        OR (
          tt.scope = 'organization'
          AND in_organization(tt.team_id, $1)
        )
      )
      ORDER BY tt.name;
    `;
    const result = await db.query(q, [req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;
    const access = await TasktemplatesController.getTaskTemplateAccess(
      id,
      req.user?.team_id
    );
    if (!access?.canAccess) {
      return res.status(404).send(new ServerResponse(false, null, "Template not found"));
    }

    // Fetch all task rows for this template (parent tasks, subtasks, and sub-subtasks)
    const q = `
      SELECT
        t.id,
        t.name,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(all_tasks))), '[]'::JSON)
          FROM (
            SELECT
              ttt.name,
              ttt.total_minutes,
              ttt.parent_task_name
            FROM task_templates_tasks ttt
            WHERE ttt.template_id = t.id
          ) all_tasks
        ) AS flat_tasks
      FROM task_templates t
      WHERE t.id = $1
    `;

    const result = await db.query(q, [id]);
    if (!result.rows.length) {
      return res.status(404).send(new ServerResponse(false, null, "Template not found"));
    }

    const row = result.rows[0];
    const flatTasks: Array<{ name: string; total_minutes: number; parent_task_name: string | null }> =
      row.flat_tasks || [];

    // ---------------------------------------------------------------
    // Build 3-level nested structure from the flat rows.
    //
    // Level 1 (parent_task_name IS NULL)  → top-level tasks
    // Level 2 (parent_task_name = L1 name) → subtasks of L1
    // Level 3 (parent_task_name = L2 name) → sub-subtasks of L2
    //
    // We use two ordered maps so insertion order is preserved.
    // ---------------------------------------------------------------

    // Map: level-1 task name → task object (with sub_tasks array)
    type L3Entry = { name: string; total_minutes: number };
    type L2Entry = { name: string; total_minutes: number; sub_tasks: L3Entry[] };
    type L1Entry = { name: string; total_minutes: number; sub_tasks: L2Entry[] };

    const level1Map = new Map<string, L1Entry>();
    const level1Order: string[] = [];

    // Map: level-2 task name → subtask object (with sub_tasks array for level-3)
    // Keyed by name — names must be unique within a template for hierarchy to resolve.
    const level2Map = new Map<string, L2Entry>();

    // Pass 1: collect level-1 tasks
    for (const task of flatTasks) {
      if (task.parent_task_name === null || task.parent_task_name === undefined) {
        if (!level1Map.has(task.name)) {
          const entry: L1Entry = { name: task.name, total_minutes: task.total_minutes, sub_tasks: [] };
          level1Map.set(task.name, entry);
          level1Order.push(task.name);
        }
      }
    }

    // Pass 2: collect level-2 subtasks and attach to level-1 parents
    for (const task of flatTasks) {
      if (task.parent_task_name !== null && task.parent_task_name !== undefined) {
        const l1Parent = level1Map.get(task.parent_task_name);
        if (l1Parent) {
          // This is a level-2 subtask
          if (!level2Map.has(task.name)) {
            const entry: L2Entry = { name: task.name, total_minutes: task.total_minutes, sub_tasks: [] };
            l1Parent.sub_tasks.push(entry);
            level2Map.set(task.name, entry);
          }
        }
      }
    }

    // Pass 3: collect level-3 sub-subtasks and attach to level-2 parents
    for (const task of flatTasks) {
      if (task.parent_task_name !== null && task.parent_task_name !== undefined) {
        const l2Parent = level2Map.get(task.parent_task_name);
        if (l2Parent) {
          // This is a level-3 sub-subtask (parent is a level-2 subtask)
          l2Parent.sub_tasks.push({ name: task.name, total_minutes: task.total_minutes });
        }
      }
    }

    const tasks = level1Order.map(name => level1Map.get(name)!);

    const data = {
      id: row.id,
      name: row.name,
      tasks,
    };

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions({
    raisedExceptions: {
        "TASK_TEMPLATE_EXISTS_ERROR": `A template with the name "{0}" already exists. Please choose a different name.`
    }
})
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {name, tasks} = req.body;
    const {id} = req.params;
    const access = await TasktemplatesController.getTaskTemplateAccess(
      id,
      req.user?.team_id
    );
    if (!access?.canManage) {
      return res.status(404).send(new ServerResponse(false, null, "Template not found"));
    }

    const q = `SELECT update_task_template($1, $2, $3, $4);`;
    const result = await db.query(q, [id, name, JSON.stringify(tasks), req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows, "Template updated."));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;

    const q = `DELETE FROM task_templates WHERE id = $1 AND team_id = $2 RETURNING id;`;
    const result = await db.query(q, [id, req.user?.team_id]);
    if (!result.rowCount) {
      return res.status(404).send(new ServerResponse(false, null, "Template not found"));
    }
    return res.status(200).send(new ServerResponse(true, result.rows, "Template deleted."));
  }

  /**
   * Duplicate a task template into the caller's team library.
   * One-click; name is "Copy of …" with numbering to avoid prefix chains.
   */
  @HandleExceptions({
    raisedExceptions: {
      "TASK_TEMPLATE_EXISTS_ERROR": `A template with the name "{0}" already exists. Please choose a different name.`
    }
  })
  public static async duplicate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;
    const teamId = req.user?.team_id;
    if (!id || !teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request."));
    }

    const access = await TasktemplatesController.getTaskTemplateAccess(id, teamId);
    if (!access?.canManage) {
      return res.status(404).send(new ServerResponse(false, null, "Template not found"));
    }

    const q = `
      SELECT
        t.id,
        t.name,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(all_tasks))), '[]'::JSON)
          FROM (
            SELECT
              ttt.name,
              ttt.total_minutes,
              ttt.parent_task_name
            FROM task_templates_tasks ttt
            WHERE ttt.template_id = t.id
          ) all_tasks
        ) AS flat_tasks
      FROM task_templates t
      WHERE t.id = $1
    `;
    const result = await db.query(q, [id]);
    if (!result.rows.length) {
      return res.status(404).send(new ServerResponse(false, null, "Template not found"));
    }

    const row = result.rows[0];
    const flatTasks: Array<{ name: string; total_minutes: number; parent_task_name: string | null }> =
      row.flat_tasks || [];

    type L3Entry = { name: string; total_minutes: number };
    type L2Entry = { name: string; total_minutes: number; sub_tasks: L3Entry[] };
    type L1Entry = { name: string; total_minutes: number; sub_tasks: L2Entry[] };

    const level1Map = new Map<string, L1Entry>();
    const level1Order: string[] = [];
    const level2Map = new Map<string, L2Entry>();

    for (const task of flatTasks) {
      if (task.parent_task_name === null || task.parent_task_name === undefined) {
        if (!level1Map.has(task.name)) {
          const entry: L1Entry = { name: task.name, total_minutes: task.total_minutes, sub_tasks: [] };
          level1Map.set(task.name, entry);
          level1Order.push(task.name);
        }
      }
    }

    for (const task of flatTasks) {
      if (task.parent_task_name !== null && task.parent_task_name !== undefined) {
        const l1Parent = level1Map.get(task.parent_task_name);
        if (l1Parent) {
          if (!level2Map.has(task.name)) {
            const entry: L2Entry = { name: task.name, total_minutes: task.total_minutes, sub_tasks: [] };
            l1Parent.sub_tasks.push(entry);
            level2Map.set(task.name, entry);
          }
        }
      }
    }

    for (const task of flatTasks) {
      if (task.parent_task_name !== null && task.parent_task_name !== undefined) {
        const l2Parent = level2Map.get(task.parent_task_name);
        if (l2Parent) {
          l2Parent.sub_tasks.push({ name: task.name, total_minutes: task.total_minutes });
        }
      }
    }

    const tasks = level1Order.map(name => level1Map.get(name)!);

    const namesResult = await db.query(
      `SELECT name FROM task_templates WHERE team_id = $1;`,
      [teamId]
    );
    const existingNames = namesResult.rows.map((r: { name: string }) => r.name);
    const copyName = allocateCopyName(row.name || "Template", existingNames);

    const createResult = await db.query(
      `SELECT create_task_template($1, $2, $3);`,
      [copyName, teamId, JSON.stringify(tasks)]
    );
    const [created] = createResult.rows;
    const newId = created?.create_task_template?.id;

    return res.status(200).send(
      new ServerResponse(
        true,
        { id: newId, name: copyName },
        "Template duplicated successfully."
      )
    );
  }

  @HandleExceptions()
  public static async updateScope(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;
    const {scope} = req.body;
    const teamId = req.user?.team_id;

    if (!id || !teamId) {
      return res.status(400).send(new ServerResponse(false, {}, "Invalid request."));
    }

    if (!["team", "organization"].includes(scope)) {
      return res.status(400).send(new ServerResponse(false, {}, "Invalid scope value."));
    }

    const q = `
      UPDATE task_templates
      SET scope = $1, updated_at = NOW()
      WHERE id = $2 AND team_id = $3
      RETURNING id, scope;
    `;
    const result = await db.query(q, [scope, id, teamId]);
    if (!result.rowCount) {
      return res.status(404).send(new ServerResponse(false, {}, "Template not found."));
    }

    return res.status(200).send(
      new ServerResponse(true, result.rows[0], "Template scope updated successfully.")
    );
  }

  @HandleExceptions()
  public static async import(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params; // project id to import tasks into
    const {templateId} = req.query as { templateId?: string };

    const access = await TasktemplatesController.getTaskTemplateAccess(
      templateId,
      req.user?.team_id
    );
    if (!access?.canAccess) {
      return res.status(404).send(new ServerResponse(false, null, "Template not found"));
    }

    const q = `SELECT import_tasks_from_template($1, $2, $3);`;
    const result = await db.query(q, [id, req.user?.id, JSON.stringify(req.body)]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data, "Tasks imported successfully!"));
  }
}
