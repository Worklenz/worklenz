import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { TASK_STATUS_COLOR_ALPHA } from "../../shared/constants";
import { getColor } from "../../shared/utils";
import WorklenzControllerBase from "../worklenz-controller-base";

export default class PtTaskPhasesController extends WorklenzControllerBase {

    private static readonly DEFAULT_PHASE_COLOR = "#fbc84c";

    @HandleExceptions()
    public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        if (!req.query.id)
            return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

        const q = `
            INSERT INTO cpt_phases (name, color_code, template_id)
            VALUES (CONCAT('Untitled Phase (', (SELECT COUNT(*) FROM cpt_phases WHERE template_id = $2) + 1, ')'), $1,
                    $2)
            RETURNING id, name, color_code;
        `;

        req.body.color_code = this.DEFAULT_PHASE_COLOR;

        const result = await db.query(q, [req.body.color_code, req.query.id]);
        const [data] = result.rows;

        data.color_code  = data.color_code + TASK_STATUS_COLOR_ALPHA;

        return res.status(200).send(new ServerResponse(true, data));
    }

    @HandleExceptions()
    public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const q = `
            SELECT id, name, color_code, (SELECT COUNT(*) FROM cpt_task_phases WHERE phase_id = cpt_phases.id) AS usage
            FROM cpt_phases
            WHERE template_id = $1
            ORDER BY created_at DESC;
        `;

        const result = await db.query(q, [req.query.id]);

        for (const phase of result.rows)
            phase.color_code = phase.color_code + TASK_STATUS_COLOR_ALPHA;

        return res.status(200).send(new ServerResponse(true, result.rows));
    }


    @HandleExceptions({
        raisedExceptions: {
            "PHASE_EXISTS_ERROR": `Phase name "{0}" already exists. Please choose a different name.`
        }
    })
    public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const q = `SELECT update_phase_name($1, $2, $3);`;

        const result = await db.query(q, [req.params.id, req.body.name.trim(), req.query.id]);
        const [data] = result.rows;

        data.update_phase_name.color_code  = data.update_phase_name.color_code + TASK_STATUS_COLOR_ALPHA;

        return res.status(200).send(new ServerResponse(true, data.update_phase_name));
    }

    @HandleExceptions()
    public static async updateLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const q = `
            UPDATE custom_project_templates
            SET phase_label = $2
            WHERE id = $1;
        `;

        const result = await db.query(q, [req.params.id, req.body.name.trim()]);
        const [data] = result.rows;
        return res.status(200).send(new ServerResponse(true, data));
    }

    @HandleExceptions()
    public static async updateColor(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
      const q = `UPDATE cpt_phases SET color_code = $3 WHERE id = $1 AND template_id = $2 RETURNING id, name, color_code;`;
      const result = await db.query(q, [req.params.id, req.query.id, req.body.color_code.substring(0, req.body.color_code.length - 2)]);
      const [data] = result.rows;
      return res.status(200).send(new ServerResponse(true, data));
    }

    @HandleExceptions()
    public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const q = `
            DELETE
            FROM cpt_phases
            WHERE id = $1
                AND template_id = $2
        `;

        const result = await db.query(q, [req.params.id, req.query.id]);
        return res.status(200).send(new ServerResponse(true, result.rows));
    }

}
