import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {getColor} from "../shared/utils";
import {calculateStorage} from "../shared/s3";
import {NotificationsService} from "../services/notifications/notifications.service";
import {SocketEvents} from "../socket.io/events";
import {IO} from "../shared/io";

export default class AdminCenterController extends WorklenzControllerBase {

  public static async checkIfUserActiveInOtherTeams(owner_id: string, email: string) {
    if (!owner_id) throw new Error("Owner not found.");

    const q = `SELECT EXISTS(SELECT tmi.team_member_id
              FROM team_member_info_view AS tmi
                       JOIN teams AS t ON tmi.team_id = t.id
                       JOIN team_members AS tm ON tmi.team_member_id = tm.id
              WHERE tmi.email = $1::TEXT
              AND t.user_id = $2::UUID AND tm.active = true);`;
    const result = await db.query(q, [email, owner_id]);

    const [data] = result.rows;
    return data.exists;
  }

  // organization
  @HandleExceptions()
  public static async getOrganizationDetails(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // const q = `SELECT organization_name                                      AS name,
    //                   contact_number,
    //                   contact_number_secondary,
    //                   (SELECT email FROM users WHERE id = users_data.user_id),
    //                   (SELECT name FROM users WHERE id = users_data.user_id) AS owner_name
    //            FROM users_data
    //            WHERE user_id = $1;`;
    const q = `SELECT organization_name                                      AS name,
                      contact_number,
                      contact_number_secondary,
                      (SELECT email FROM users WHERE id = organizations.user_id),
                      (SELECT name FROM users WHERE id = organizations.user_id) AS owner_name
                  FROM organizations
                  WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getOrganizationAdmins(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT u.name, email, owner AS is_owner
               FROM users u
                      LEFT JOIN team_members tm ON u.id = tm.user_id
                      LEFT JOIN roles r ON tm.role_id = r.id
               WHERE tm.team_id IN (SELECT id FROM teams WHERE teams.user_id = $1)
                 AND (admin_role IS TRUE OR owner IS TRUE)
               GROUP BY u.name, email, owner
               ORDER BY owner DESC, u.name;`;
    const result = await db.query(q, [req.user?.owner_id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getOrganizationUsers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { searchQuery, size, offset } = this.toPaginationOptions(req.query, ["outer_tmiv.name", "outer_tmiv.email"]);

    const q = `SELECT ROW_TO_JSON(rec) AS users
            FROM (SELECT COUNT(*) AS total,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                          FROM (SELECT email,
                                      STRING_AGG(DISTINCT CAST(user_id AS VARCHAR), ', ') AS user_id,
                                      STRING_AGG(DISTINCT name, ', ') AS name,
                                      STRING_AGG(DISTINCT avatar_url, ', ') AS avatar_url,
                                      (SELECT twl.created_at
                                        FROM task_work_log twl
                                        WHERE twl.user_id IN (SELECT tmiv.user_id
                                                              FROM team_member_info_view tmiv
                                                              WHERE tmiv.email = outer_tmiv.email)
                                        ORDER BY created_at DESC
                                        LIMIT 1) AS last_logged
                                FROM team_member_info_view outer_tmiv
                                WHERE outer_tmiv.team_id IN (SELECT id
                                                            FROM teams
                                                            WHERE teams.user_id = $1) ${searchQuery}
                                GROUP BY email
                                ORDER BY email LIMIT $2 OFFSET $3) t) AS data
                  FROM (SELECT DISTINCT email
                        FROM team_member_info_view outer_tmiv
                        WHERE outer_tmiv.team_id IN
                              (SELECT id
                              FROM teams
                              WHERE teams.user_id = $1) ${searchQuery}) AS total) rec;`;
    const result = await db.query(q, [req.user?.owner_id, size, offset]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.users));
  }

  @HandleExceptions()
  public static async updateOrganizationName(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {name} = req.body;
    // const q = `UPDATE users_data
    //            SET organization_name = $1
    //            WHERE user_id = $2;`;
    const q = `UPDATE organizations
               SET organization_name = $1
               WHERE user_id = $2;`;
    const result = await db.query(q, [name, req.user?.owner_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateOwnerContactNumber(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {contact_number} = req.body;
    const q = `UPDATE organizations
               SET contact_number = $1
               WHERE user_id = $2;`;
    const result = await db.query(q, [contact_number, req.user?.owner_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = ``;
    const result = await db.query(q, []);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getOrganizationTeams(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery, size, offset} = this.toPaginationOptions(req.query, ["name"]);

    let size_changed = size;

    if (offset == 0) size_changed = size_changed - 1;

    const currentTeamClosure = offset == 0 ? `,
                          (SELECT COALESCE(ROW_TO_JSON(c), '{}'::JSON)
                            FROM (SELECT id,
                                          name,
                                          created_at,
                                          (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                                          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                          FROM (SELECT CASE
                                                          WHEN u.name IS NOT NULL THEN u.name
                                                          ELSE (SELECT name
                                                                FROM email_invitations
                                                                WHERE team_member_id = team_members.id) END,
                                                        avatar_url
                                                FROM team_members
                                                        LEFT JOIN users u on team_members.user_id = u.id
                                                WHERE team_id = teams.id) rec)                        AS team_members
                                  FROM teams
                                  WHERE user_id = $1 AND teams.id = $4) c) AS current_team_data` : ``;

    const q = `SELECT ROW_TO_JSON(rec) AS teams
               FROM (SELECT COUNT(*)                      AS total,
                            (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                             FROM (SELECT id,
                                          name,
                                          created_at,
                                          (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                                          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                           FROM (SELECT CASE
                                                          WHEN u.name IS NOT NULL THEN u.name
                                                          ELSE (SELECT name
                                                                FROM email_invitations
                                                                WHERE team_member_id = team_members.id) END,
                                                        avatar_url
                                                 FROM team_members
                                                        LEFT JOIN users u on team_members.user_id = u.id
                                                 WHERE team_id = teams.id) rec)                        AS team_members
                                   FROM teams
                                   WHERE user_id = $1 AND NOT teams.id = $4 ${searchQuery}
                                   ORDER BY name, created_at
                                   LIMIT $2 OFFSET $3) t) AS data
                                   ${currentTeamClosure}
                     FROM teams
                     WHERE user_id = $1 ${searchQuery}) rec;`;
    const result = await db.query(q, [req.user?.owner_id, size_changed, offset, req.user?.team_id]);

    const [obj] = result.rows;

    for (const team of obj.teams?.data || []) {
      team.names = this.createTagList(team?.team_members);
      team.names.map((a: any) => a.color_code = getColor(a.name));
    }

    if (obj.teams.current_team_data) {
      obj.teams.current_team_data.names = this.createTagList(obj.teams.current_team_data?.team_members);
      obj.teams.current_team_data.names.map((a: any) => a.color_code = getColor(a.name));
    }

    return res.status(200).send(new ServerResponse(true, obj.teams || {}));
  }

  @HandleExceptions()
  public static async getTeamDetails(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;

    const q = `SELECT id,
                      name,
                      created_at,
                      (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                       FROM (SELECT tm.id,
                                    tm.user_id,
                                    (SELECT name
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    (SELECT team_member_info_view.email
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    (SELECT team_member_info_view.avatar_url
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    role_id,
                                    r.name AS role_name
                             FROM team_members tm
                                    LEFT JOIN users u on tm.user_id = u.id
                                    LEFT JOIN roles r on tm.role_id = r.id
                             WHERE tm.team_id = teams.id
                             ORDER BY r.name = 'Owner' DESC, u.name) rec)          AS team_members
               FROM teams
               WHERE id = $1;`;
    const result = await db.query(q, [id]);

    const [obj] = result.rows;

    obj.names = this.createTagList(obj?.team_members);
    obj.names.map((a: any) => a.color_code = getColor(a.name));

    return res.status(200).send(new ServerResponse(true, obj || {}));
  }

  @HandleExceptions()
  public static async updateTeam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;
    const {name, teamMembers} = req.body;

    const updateNameQuery = `UPDATE teams
                             SET name = $1
                             WHERE id = $2;`;
    await db.query(updateNameQuery, [name, id]);

    if (teamMembers.length) {
      teamMembers.forEach(async (element: { role_name: string; user_id: string; }) => {
        const q = `UPDATE team_members
                   SET role_id = (SELECT id FROM roles WHERE roles.team_id = $1 AND name = $2)
                   WHERE user_id = $3
                     AND team_id = $1;`;
        await db.query(q, [id, element.role_name, element.user_id]);
      });
    }

    return res.status(200).send(new ServerResponse(true, [], "Team updated successfully"));
  }

  @HandleExceptions()
  public static async deleteTeam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;

    if (id == req.user?.team_id) {
      return res.status(200).send(new ServerResponse(true, [], "Please switch to another team before attempting deletion.")
        .withTitle("Unable to remove the presently active team!"));
    }

    const q = `DELETE FROM teams WHERE id = $1;`;
    const result = await db.query(q, [id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;
    const {teamId} = req.body;

    if (!id || !teamId) return res.status(200).send(new ServerResponse(false, "Required fields are missing."));


    const q = `SELECT remove_team_member($1, $2, $3) AS member;`;
    const result = await db.query(q, [id, req.user?.id, teamId]);
    const [data] = result.rows;

    const message = `You have been removed from <b>${req.user?.team_name}</b> by <b>${req.user?.name}</b>`;

    NotificationsService.sendNotification({
      receiver_socket_id: data.socket_id,
      message,
      team: data.team,
      team_id: id
    });

    IO.emitByUserId(data.member.id, req.user?.id || null, SocketEvents.TEAM_MEMBER_REMOVED, {
      teamId: id,
      message
    });
    return res.status(200).send(new ServerResponse(true, result.rows));
  }


}
