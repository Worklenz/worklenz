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
    const q = `SELECT id, name,
       ((SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
         FROM (SELECT task_templates_tasks.name AS name,
                      task_templates_tasks.total_minutes AS total_minutes
               FROM task_templates_tasks
               WHERE template_id = task_templates.id) rec)) AS tasks
        FROM task_templates
        WHERE id = $1
        ORDER BY name`;
    const result = await db.query(q, [id]);
    const [data] = result.rows;
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
