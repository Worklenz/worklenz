import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";


export default class ProjectManagersController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getByOrg(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // const q = `SELECT DISTINCT (SELECT user_id from team_member_info_view tmv WHERE tmv.team_member_id = pm.team_member_id),
    //                   team_member_id,
    //                   (SELECT name from team_member_info_view tmv WHERE tmv.team_member_id = pm.team_member_id)
    //               FROM project_members pm
    //               WHERE project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')
    //               AND pm.project_id IN (SELECT id FROM projects WHERE team_id IN (SELECT id FROM teams WHERE in_organization(id, $1)));`;
    // const q = `SELECT DISTINCT tmv.user_id,
    //                            tmv.name,
    //                            pm.team_member_id
    //             FROM team_member_info_view tmv
    //             INNER JOIN project_members pm ON tmv.team_member_id = pm.team_member_id
    //             INNER JOIN projects p ON pm.project_id = p.id
    //             WHERE pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')
    //               AND p.team_id IN (SELECT id FROM teams WHERE in_organization(id, $1))`;
    const q = `SELECT DISTINCT ON (tm.user_id)
                    tm.user_id AS id,
                    u.name,
                    pm.team_member_id
                FROM
                    projects p
                JOIN project_members pm ON p.id = pm.project_id
                JOIN teams t ON p.team_id = t.id
                JOIN team_members tm ON pm.team_member_id = tm.id
                JOIN team_member_info_view tmi ON tm.id = tmi.team_member_id
                JOIN users u ON tm.user_id = u.id
                WHERE
                    t.id IN (SELECT id FROM teams WHERE in_organization(id, $1))
                    AND pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')
                GROUP BY
                    tm.user_id, u.name, pm.team_member_id`;
    const result = await db.query(q, [_req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
