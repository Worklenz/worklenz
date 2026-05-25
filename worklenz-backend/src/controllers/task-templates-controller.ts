import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class TasktemplatesController extends WorklenzControllerBase {
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
    const q = `SELECT id, name, created_at FROM task_templates WHERE team_id = $1 ORDER BY name;`;
    const result = await db.query(q, [req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;

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

    const q = `SELECT update_task_template($1, $2, $3, $4);`;
    const result = await db.query(q, [id, name, JSON.stringify(tasks), req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows, "Template updated."));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;

    const q = `DELETE FROM task_templates WHERE id = $1;`;
    const result = await db.query(q, [id]);
    return res.status(200).send(new ServerResponse(true, result.rows, "Template deleted."));
  }

  @HandleExceptions()
  public static async import(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;

    const q = `SELECT import_tasks_from_template($1, $2, $3);`;
    const result = await db.query(q, [id, req.user?.id, JSON.stringify(req.body)]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data, "Tasks imported successfully!"));
  }
}
