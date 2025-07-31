import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";

const existsErrorMessage = "At least one status should exists under each category.";

export default class PtTaskStatusesController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        INSERT INTO cpt_task_statuses (name, template_id, team_id, category_id, sort_order)
        VALUES ($1, $2, $3, $4, (SELECT MAX(sort_order) FROM cpt_task_statuses WHERE template_id = $2) + 1);
      `;
    const result = await db.query(q, [req.body.name, req.body.template_id, req.user?.team_id, req.body.category_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getCreated(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const team_id = req.user?.team_id;
    const q = `SELECT create_pt_task_status($1, $2)`;
    const result = await db.query(q, [JSON.stringify(req.body), team_id]);
    const data = result.rows[0].create_pt_task_status[0];
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.query.template_id)
      return res.status(400).send(new ServerResponse(false, null));

    const q = `
          SELECT cpt_task_statuses.id,
                cpt_task_statuses.name,
                stsc.color_code,
                stsc.name AS category_name,
                cpt_task_statuses.category_id,
                stsc.description
          FROM cpt_task_statuses
                INNER JOIN sys_task_status_categories stsc ON cpt_task_statuses.category_id = stsc.id
          WHERE template_id = $1
            AND team_id = $2
          ORDER BY cpt_task_statuses.sort_order;
        `;

    const result = await db.query(q, [req.query.template_id, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }


  @HandleExceptions()
  public static async getCategories(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, color_code, description
               FROM sys_task_status_categories
               ORDER BY index;`;
    const result = await db.query(q, []);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }


  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT cpt_task_statuses.id, cpt_task_statuses.name, stsc.color_code
      FROM cpt_task_statuses
             INNER JOIN sys_task_status_categories stsc ON cpt_task_statuses.category_id = stsc.id
      WHERE cpt_task_statuses.id = $1
        AND template_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.query.template_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async hasMoreCategories(statusId: string, templateId: string) {
    if (!statusId || !templateId)
      return false;

    const q = `
      SELECT COUNT(*) AS count
      FROM cpt_task_statuses
      WHERE category_id = (SELECT category_id FROM cpt_task_statuses WHERE id = $1)
        AND template_id = $2;
    `;

    const result = await db.query(q, [statusId, templateId]);
    const [data] = result.rows;
    return +data.count >= 2;
  }


  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const hasMoreCategories = await PtTaskStatusesController.hasMoreCategories(req.params.id, req.body.template_id);

    if (!hasMoreCategories)
      return res.status(200).send(new ServerResponse(false, null, existsErrorMessage).withTitle("Status update failed!"));

    const q = `
      UPDATE cpt_task_statuses
      SET name = $2,
          category_id = COALESCE($4, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE))
      WHERE id = $1
        AND template_id = $3
      RETURNING (SELECT color_code FROM sys_task_status_categories WHERE id = cpt_task_statuses.category_id);
    `;
    const result = await db.query(q, [req.params.id, req.body.name, req.body.template_id, req.body.category_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions({
    raisedExceptions: {
      "STATUS_EXISTS_ERROR": `Status name "{0}" already exists. Please choose a different name.`
    }
  })
  public static async updateName(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DO
              $$
              BEGIN
                  -- check whether the status name is already in
                  IF EXISTS(SELECT name
                            FROM cpt_task_statuses
                            WHERE name = '${req.body.name}'::TEXT
                              AND template_id = '${req.body.template_id}'::UUID)
                  THEN
                      RAISE 'STATUS_EXISTS_ERROR:%', ('${req.body.name}')::TEXT;
                  END IF;

                  UPDATE cpt_task_statuses
                  SET name = '${req.body.name}'::TEXT
                  WHERE id = '${req.params.id}'::UUID
                    AND template_id = '${req.body.template_id}'::UUID;
              END
              $$;`;
    const result = await db.query(q, []);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

}