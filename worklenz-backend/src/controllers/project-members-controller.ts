import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {getColor} from "../shared/utils";
import TeamMembersController from "./team-members-controller";
import {checkTeamSubscriptionStatus} from "../shared/paddle-utils";
import {updateUsers} from "../shared/paddle-requests";
import {statusExclude, TRIAL_MEMBER_LIMIT} from "../shared/constants";
import {NotificationsService} from "../services/notifications/notifications.service";

export default class ProjectMembersController extends WorklenzControllerBase {

  public static async checkIfUserAlreadyExists(owner_id: string, email: string) {
    if (!owner_id) throw new Error("Owner not found.");

    const q = `SELECT EXISTS(SELECT tmi.team_member_id
              FROM team_member_info_view AS tmi
                       JOIN teams AS t ON tmi.team_id = t.id
              WHERE tmi.email = $1::TEXT
                AND t.user_id = $2::UUID);`;
    const result = await db.query(q, [email, owner_id]);

    const [data] = result.rows;
    return data.exists;
  }

  public static async createOrInviteMembers(body: any) {
    if (!body) return;

    const q = `SELECT create_project_member($1) AS res;`;

    const result = await db.query(q, [JSON.stringify(body)]);
    const [data] = result.rows;

    const response = data.res;

    if (response?.notification && response?.member_user_id) {
      NotificationsService.sendNotification({
        receiver_socket_id: response.socket_id,
        project: response.project,
        message: response.notification,
        project_color: response.project_color,
        project_id: response.project_id,
        team: response.team,
        team_id: body.team_id
      });
    }
    return data;
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.user_id = req.user?.id;
    req.body.team_id = req.user?.team_id;
    req.body.access_level = req.body.access_level ? req.body.access_level : "MEMBER";
    const data = await this.createOrInviteMembers(req.body);
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions({
    raisedExceptions: {
      "ERROR_EMAIL_INVITATION_EXISTS": "Member already have a pending invitation that has not been accepted."
    }
  })
  public static async createByEmail(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.user_id = req.user?.id;
    req.body.team_id = req.user?.team_id;

    if (!req.user?.team_id) return res.status(200).send(new ServerResponse(false, "Required fields are missing."));

    // check the subscription status
    const subscriptionData = await checkTeamSubscriptionStatus(req.user?.team_id);

    const userExists = await this.checkIfUserAlreadyExists(req.user?.owner_id as string, req.body.email);

    // Return error if user already exists
    if (userExists) {
      return res.status(200).send(new ServerResponse(false, null, "User already exists in the team."));
    }

    // Handle self-hosted subscriptions differently
    if (subscriptionData.subscription_type === 'SELF_HOSTED') {
      // Adding as a team member
      const teamMemberReq: { team_id?: string; emails: string[], project_id?: string; } = {
        team_id: req.user?.team_id,
        emails: [req.body.email]
      };

      if (req.body.project_id)
        teamMemberReq.project_id = req.body.project_id;

      const [member] = await TeamMembersController.createOrInviteMembers(teamMemberReq, req.user);

      if (!member)
        return res.status(200).send(new ServerResponse(true, null, "Failed to add the member to the project. Please try again."));

      // Adding to the project
      const projectMemberReq = {
        team_member_id: member.team_member_id,
        team_id: req.user?.team_id,
        project_id: req.body.project_id,
        user_id: req.user?.id,
        access_level: req.body.access_level ? req.body.access_level : "MEMBER"
      };
      const data = await this.createOrInviteMembers(projectMemberReq);
      return res.status(200).send(new ServerResponse(true, data.member));
    }

    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res.status(200).send(new ServerResponse(false, null, "Unable to add user! Please check your subscription status."));
    }

    if (!userExists && subscriptionData.is_ltd && subscriptionData.current_count && (parseInt(subscriptionData.current_count) + 1 > parseInt(subscriptionData.ltd_users))) {
      return res.status(200).send(new ServerResponse(false, null, "Maximum number of life time users reached."));
    }

    /**
   * Checks trial user team member limit
   */
    if (subscriptionData.subscription_status === "trialing") {
      const currentTrialMembers = parseInt(subscriptionData.current_count) || 0;
      
      if (currentTrialMembers + 1 > TRIAL_MEMBER_LIMIT) {
        return res.status(200).send(new ServerResponse(false, null, `Trial users cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please upgrade to add more members.`));
      }
    }

    // if (subscriptionData.status === "trialing") break;
    if (!userExists && !subscriptionData.is_credit && !subscriptionData.is_custom && subscriptionData.subscription_status !== "trialing") {
      // if (subscriptionData.subscription_status === "active") {
      //   const response = await updateUsers(subscriptionData.subscription_id, (subscriptionData.quantity + 1));
      //   if (!response.body.subscription_id) return res.status(200).send(new ServerResponse(false, null, response.message || "Unable to add user! Please check your subscription."));
      // }
      const updatedCount = parseInt(subscriptionData.current_count) + 1;
      const requiredSeats = updatedCount - subscriptionData.quantity;
      if (updatedCount > subscriptionData.quantity) {
        const obj = { 
          seats_enough: false, 
          required_count: requiredSeats,
          current_seat_amount: subscriptionData.quantity
        };
        return res.status(200).send(new ServerResponse(false, obj, null));
      }
    }

    // Adding as a team member
    const teamMemberReq: { team_id?: string; emails: string[], project_id?: string; } = {
      team_id: req.user?.team_id,
      emails: [req.body.email]
    };

    if (req.body.project_id)
      teamMemberReq.project_id = req.body.project_id;

    const [member] = await TeamMembersController.createOrInviteMembers(teamMemberReq, req.user);

    if (!member)
      return res.status(200).send(new ServerResponse(true, null, "Failed to add the member to the project. Please try again."));

    // Adding to the project
    const projectMemberReq = {
      team_member_id: member.team_member_id,
      team_id: req.user?.team_id,
      project_id: req.body.project_id,
      user_id: req.user?.id,
      access_level: req.body.access_level ? req.body.access_level : "MEMBER"
    };
    const data = await this.createOrInviteMembers(projectMemberReq);
    return res.status(200).send(new ServerResponse(true, data.member));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT project_members.id,
             tm.id AS team_member_id,
             (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id),
             (SELECT name FROM team_member_info_view WHERE team_member_id = project_members.team_member_id) AS name,
             u.avatar_url,
             jt.name AS job_title
      FROM project_members
             INNER JOIN team_members tm ON project_members.team_member_id = tm.id
             LEFT JOIN job_titles jt ON tm.job_title_id = jt.id
             LEFT JOIN users u ON tm.user_id = u.id
      WHERE project_id = $1
      ORDER BY project_members.created_at DESC;
    `;
    const result = await db.query(q, [req.params.id]);

    result.rows.forEach((a: any) => a.color_code = getColor(a.name));

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  public static async checkIfMemberExists(projectId: string, teamMemberId: string) {
    const q = `SELECT EXISTS(SELECT id FROM project_members WHERE project_id = $1::UUID AND team_member_id = $2::UUID)`;
    const result = await db.query(q, [projectId, teamMemberId]);
    const [data] = result.rows;
    return data.exists;
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT remove_project_member($1, $2, $3) AS res;`;
    const result = await db.query(q, [req.params.id, req.user?.id, req.user?.team_id]);
    const [data] = result.rows;

    const response = data.res;

    if (response?.notification && response?.member_user_id) {
      NotificationsService.sendNotification({
        receiver_socket_id: response.socket_id,
        project: response.project,
        message: response.notification,
        project_color: response.project_color,
        project_id: response.project_id,
        team: response.team,
        team_id: req.user?.team_id as string
      });
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
