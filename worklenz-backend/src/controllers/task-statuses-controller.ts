import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

const existsErrorMessage = "At least one status should exists under each category.";

export default class TaskStatusesController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
      VALUES ($1, $2, $3, $4, (SELECT MAX(sort_order) FROM task_statuses WHERE project_id = $2) + 1);
    `;
    const result = await db.query(q, [req.body.name, req.body.project_id, req.user?.team_id, req.body.category_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getCreated(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const team_id = req.user?.team_id;
    const q = `SELECT create_task_status($1, $2)`;
    const result = await db.query(q, [JSON.stringify(req.body), team_id]);
    const data = result.rows[0].create_task_status[0];
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.query.project)
      return res.status(400).send(new ServerResponse(false, null));

    const q = `
      SELECT task_statuses.id,
             task_statuses.name,
             stsc.color_code,
             stsc.name AS category_name,
             task_statuses.category_id,
             stsc.description
      FROM task_statuses
             INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
      WHERE project_id = $1
        AND team_id = $2
      ORDER BY task_statuses.sort_order;
    `;
    const result = await db.query(q, [req.query.project, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getCategories(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, color_code, color_code_dark, description
               FROM sys_task_status_categories
               ORDER BY index;`;
    const result = await db.query(q, []);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  private static async getStatusByGroups(projectId: string) {
    if (!projectId) return;

    const q = ``;
    const result = await db.query(q, [projectId]);
    return result.rows;
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT task_statuses.id, task_statuses.name, stsc.color_code, stsc.color_code_dark
      FROM task_statuses
             INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
      WHERE task_statuses.id = $1
        AND project_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.query.project_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async hasMoreCategories(statusId: string, projectId: string) {
    if (!statusId || !projectId)
      return false;

    const q = `
      SELECT COUNT(*) AS count
      FROM task_statuses
      WHERE category_id = (SELECT category_id FROM task_statuses WHERE id = $1)
        AND project_id = $2;
    `;

    const result = await db.query(q, [statusId, projectId]);
    const [data] = result.rows;
    return +data.count >= 2;
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const hasMoreCategories = await TaskStatusesController.hasMoreCategories(req.params.id, req.body.project_id);

    if (!hasMoreCategories)
      return res.status(200).send(new ServerResponse(false, null, existsErrorMessage).withTitle("Status update failed!"));

    const q = `
      UPDATE task_statuses
      SET name        = $2,
          category_id = COALESCE($4, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE))
      WHERE id = $1
        AND project_id = $3
      RETURNING (SELECT color_code FROM sys_task_status_categories WHERE id = task_statuses.category_id), (SELECT color_code_dark FROM sys_task_status_categories WHERE id = task_statuses.category_id);
    `;
    const result = await db.query(q, [req.params.id, req.body.name, req.body.project_id, req.body.category_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateName(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        UPDATE task_statuses
        SET name = $2
        WHERE id = $1
          AND project_id = $3
        RETURNING (SELECT color_code FROM sys_task_status_categories WHERE id = task_statuses.category_id);
    `;
    const result = await db.query(q, [req.params.id, req.body.name, req.body.project_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateCategory(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const hasMoreCategories = await TaskStatusesController.hasMoreCategories(req.params.id, req.query.current_project_id as string);

    if (!hasMoreCategories)
      return res.status(200).send(new ServerResponse(false, null, existsErrorMessage).withTitle("Status category update failed!"));

    const q = `
      UPDATE task_statuses
      SET category_id = $2
      WHERE id = $1
        AND project_id = $3
      RETURNING (SELECT color_code FROM sys_task_status_categories WHERE id = task_statuses.category_id), (SELECT color_code_dark FROM sys_task_status_categories WHERE id = task_statuses.category_id);
    `;
    const result = await db.query(q, [req.params.id, req.body.category_id, req.query.current_project_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateStatusOrder(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT update_status_order($1);`;
    const result = await db.query(q, [JSON.stringify(req.body.status_order)]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions({
    raisedExceptions: {
      "ERROR_ONE_SHOULD_EXISTS": existsErrorMessage
    }
  })
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT move_tasks_and_delete_status($1)`;

    const body = {
      id: req.params.id,
      project_id: req.query.project,
      replacing_status: req.query.replace
    };

    const result = await db.query(q, [JSON.stringify(body)]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
