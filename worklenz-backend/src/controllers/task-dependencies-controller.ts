import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class TaskdependenciesController extends WorklenzControllerBase {
  @HandleExceptions({
    raisedExceptions: {
      "DEPENDENCY_EXISTS": `Task dependency already exists.`,
      "SELF_DEPENDENCY": `A task cannot depend on itself.`,
      "CIRCULAR_DEPENDENCY": `This dependency would create a circular relationship.`
    }
  })
  public static async saveTaskDependency(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {task_id, related_task_id, dependency_type } = req.body;
    const q = `SELECT insert_task_dependency($1, $2, $3);`;
    const result = await db.query(q, [task_id, related_task_id, dependency_type]);
    // Bump task updated_at so "Updated X ago" reflects the new dependency
    await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [task_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getTaskDependencies(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    const q = `SELECT 
                    td.id,
                    t2.name AS task_name,
                    td.dependency_type,
                    CONCAT(p.key, '-', t2.task_no) AS task_key
                FROM 
                    task_dependencies td
                LEFT JOIN 
                    tasks t ON td.task_id = t.id
                LEFT JOIN 
                    tasks t2 ON td.related_task_id = t2.id
                LEFT JOIN 
                    projects p ON t.project_id = p.id
                WHERE 
                    td.task_id = $1;`;
    const result = await db.query(q, [id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;
    
    const q = `DELETE FROM task_dependencies WHERE id = $1 RETURNING task_id;`;
    const result = await db.query(q, [id]);
    const [data] = result.rows;
    if (data) {
    // Bump task updated_at so "Updated X ago" reflects the removed dependency
    if (data.task_id) await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [data.task_id]);
    }
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}