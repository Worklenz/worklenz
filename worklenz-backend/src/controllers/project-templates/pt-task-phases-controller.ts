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
        const teamId = req.user?.team_id;
        const templateId = req.query.id as string;
        if (!teamId || !templateId)
            return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

        const q = `
            INSERT INTO cpt_phases (name, color_code, template_id)
            SELECT CONCAT('Untitled Phase (', (SELECT COUNT(*) FROM cpt_phases WHERE template_id = $2) + 1, ')'), $1, $2
            FROM custom_project_templates cpt
            WHERE cpt.id = $2 AND cpt.team_id = $3
            RETURNING id, name, color_code;
        `;

        req.body.color_code = this.DEFAULT_PHASE_COLOR;

        const result = await db.query(q, [req.body.color_code, templateId, teamId]);
        if (!result.rows.length) {
            return res.status(403).send(new ServerResponse(false, null, "Template not found or unauthorized"));
        }
        const [data] = result.rows;

        data.color_code = data.color_code + TASK_STATUS_COLOR_ALPHA;

        return res.status(200).send(new ServerResponse(true, data));
    }

    @HandleExceptions()
    public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const teamId = req.user?.team_id;
        const templateId = req.query.id as string;
        if (!teamId || !templateId)
            return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

        const q = `
            SELECT cp.id, cp.name, cp.color_code, (SELECT COUNT(*) FROM cpt_task_phases WHERE phase_id = cp.id) AS usage
            FROM cpt_phases cp
            JOIN custom_project_templates cpt ON cpt.id = cp.template_id
            WHERE cp.template_id = $1 AND (cpt.team_id = $2 OR (cpt.scope = 'organization' AND in_organization(cpt.team_id, $2)))
            ORDER BY cp.created_at DESC;
        `;

        const result = await db.query(q, [templateId, teamId]);

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
        const teamId = req.user?.team_id;
        const templateId = req.query.id as string;
        if (!teamId || !templateId)
            return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

        const templateCheck = await db.query(
            `SELECT 1 FROM custom_project_templates WHERE id = $1 AND team_id = $2`,
            [templateId, teamId]
        );
        if (!templateCheck.rows.length) {
            return res.status(403).send(new ServerResponse(false, null, "Template not found or unauthorized"));
        }

        const q = `SELECT update_phase_name($1, $2, $3);`;

        const result = await db.query(q, [req.params.id, req.body.name.trim(), templateId]);
        const [data] = result.rows;

        data.update_phase_name.color_code = data.update_phase_name.color_code + TASK_STATUS_COLOR_ALPHA;

        return res.status(200).send(new ServerResponse(true, data.update_phase_name));
    }

    @HandleExceptions()
    public static async updateLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const teamId = req.user?.team_id;
        if (!teamId)
            return res.status(401).send(new ServerResponse(false, null, "Authentication required"));

        const q = `
            UPDATE custom_project_templates
            SET phase_label = $2
            WHERE id = $1 AND team_id = $3
            RETURNING id, phase_label;
        `;

        const result = await db.query(q, [req.params.id, req.body.name.trim(), teamId]);
        if (!result.rows.length) {
            return res.status(404).send(new ServerResponse(false, null, "Template not found"));
        }
        const [data] = result.rows;
        return res.status(200).send(new ServerResponse(true, data));
    }

    @HandleExceptions()
    public static async updateColor(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
      const teamId = req.user?.team_id;
      const templateId = req.query.id as string;
      if (!teamId || !templateId)
          return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

      const q = `
        UPDATE cpt_phases
        SET color_code = $3
        WHERE id = $1 AND template_id = $2
          AND template_id IN (SELECT id FROM custom_project_templates WHERE team_id = $4)
        RETURNING id, name, color_code;
      `;
      const result = await db.query(q, [
        req.params.id,
        templateId,
        req.body.color_code.substring(0, req.body.color_code.length - 2),
        teamId
      ]);
      if (!result.rows.length) {
        return res.status(404).send(new ServerResponse(false, null, "Phase not found"));
      }
      const [data] = result.rows;
      return res.status(200).send(new ServerResponse(true, data));
    }

    @HandleExceptions()
    public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const teamId = req.user?.team_id;
        const templateId = req.query.id as string;
        if (!teamId || !templateId)
            return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

        const q = `
            DELETE
            FROM cpt_phases
            WHERE id = $1
                AND template_id = $2
                AND template_id IN (SELECT id FROM custom_project_templates WHERE team_id = $3)
            RETURNING id;
        `;

        const result = await db.query(q, [req.params.id, templateId, teamId]);
        if (!result.rows.length) {
            return res.status(404).send(new ServerResponse(false, null, "Phase not found"));
        }
        return res.status(200).send(new ServerResponse(true, result.rows));
    }

}
