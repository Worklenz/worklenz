import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { IPassportSession } from "../interfaces/passport-session";
import crypto from "crypto";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getColor } from "../shared/utils";
import TeamMembersController from "./team-members-controller";
import business from "../business";
import { statusExclude, TRIAL_MEMBER_LIMIT, APPSUMO_PLAN_LIMIT, BUSINESS_PLAN_LIMIT } from "../shared/constants";
import { getTeamMemberSeatLimit } from "../shared/subscription-limits";
import { NotificationsService } from "../services/notifications/notifications.service";
import { sendInvitationEmail } from "../shared/email-templates";

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
    // Default to MEMBER access level - can be changed later if needed
    req.body.access_level = req.body.access_level || "MEMBER";
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
    const subscriptionData = await business.featureGate.getTeamSubscription(req.user?.team_id);

    // Check if user already exists in the team
    const userExists = await this.checkIfUserAlreadyExists(req.user?.owner_id as string, req.body.email);

    // If user exists in the team, check if they're already in the project
    if (userExists && req.body.project_id) {
      // Get the team member information from email
      const teamMemberQuery = `
        SELECT team_member_id, name, email, user_id
        FROM team_member_info_view
        WHERE email = $1 AND team_id = $2
      `;
      const teamMemberResult = await db.query(teamMemberQuery, [req.body.email, req.user?.team_id]);

      if (teamMemberResult.rows.length > 0) {
        const teamMemberInfo = teamMemberResult.rows[0];
        const teamMemberId = teamMemberInfo.team_member_id;

        // Check if already a project member
        const projectMemberExists = await this.checkIfMemberExists(req.body.project_id, teamMemberId);

        if (projectMemberExists) {
          return res.status(200).send(new ServerResponse(false, null, "User already exists in the project."));
        }

        // User exists in team but not in project - add them to the project
        const projectMemberReq = {
          team_member_id: teamMemberId,
          team_id: req.user?.team_id,
          project_id: req.body.project_id,
          user_id: req.user?.id,
          access_level: req.body.access_level || "MEMBER" // Use provided access_level or default to MEMBER
        };
        const data = await this.createOrInviteMembers(projectMemberReq);

        // Send email invitation to existing team member for the project
        // This ensures they receive an email notification and can access the project
        if (teamMemberInfo.email && teamMemberInfo.name) {
          sendInvitationEmail(
            true, // isNewMember = true (existing team member, not a new user)
            req.user as IPassportSession,
            teamMemberInfo.name, // userNameOrId = name for existing members
            teamMemberInfo.email,
            teamMemberInfo.user_id || teamMemberId, // userId - use team_member_id as fallback if user_id is null
            teamMemberInfo.name, // userName
            req.body.project_id // projectId - this allows them to access the project directly
          );
        }

        return res.status(200).send(new ServerResponse(true, data.member));
      }
    }

    // If user exists in team but no project_id provided, return error
    if (userExists) {
      return res.status(200).send(new ServerResponse(false, null, "User already exists in the team."));
    }

    // Handle self-hosted subscriptions differently
    if (subscriptionData.subscription_type === 'SELF_HOSTED') {
      // Adding as a team member
      const teamMemberReq: { team_id?: string; emails: string[], project_id?: string; role_name?: string; is_admin?: boolean; job_title_id?: string; } = {
        team_id: req.user?.team_id,
        emails: [req.body.email]
      };

      if (req.body.project_id)
        teamMemberReq.project_id = req.body.project_id;

      // Pass role information for team member creation
      if (req.body.role_name)
        teamMemberReq.role_name = req.body.role_name;
      if (req.body.is_admin !== undefined)
        teamMemberReq.is_admin = req.body.is_admin;
      if (req.body.job_title_id)
        teamMemberReq.job_title_id = req.body.job_title_id;

      const [member] = await TeamMembersController.createOrInviteMembers(teamMemberReq, req.user);

      if (!member)
        return res.status(200).send(new ServerResponse(false, null, "Failed to add the member to the project. Please try again."));

      // Adding to the project - default to MEMBER access level
      // Access level can be changed later if needed
      const projectMemberReq = {
        team_member_id: member.team_member_id,
        team_id: req.user?.team_id,
        project_id: req.body.project_id,
        user_id: req.user?.id,
        access_level: "MEMBER" // Always default to MEMBER for new invitations
      };
      const data = await this.createOrInviteMembers(projectMemberReq);
      return res.status(200).send(new ServerResponse(true, data.member));
    }

    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res.status(200).send(new ServerResponse(false, null, "Unable to add user! Please check your subscription status."));
    }

    /**
   * Checks trial user team member limit
   */
    if (subscriptionData.subscription_status === "trialing" && subscriptionData.team_member_limit_override !== true) {
      const currentTrialMembers = parseInt(subscriptionData.current_count) || 0;

      if (currentTrialMembers + 1 > TRIAL_MEMBER_LIMIT) {
        const obj = {
          error_code: 'SEAT_LIMIT_EXCEEDED',
          seats_enough: false,
          current_members: currentTrialMembers,
          plan_seat_limit: TRIAL_MEMBER_LIMIT,
          business_plan_limit: BUSINESS_PLAN_LIMIT,
          is_appsumo_user: false,
          subscription_type: subscriptionData.subscription_type,
          current_seat_amount: TRIAL_MEMBER_LIMIT,
        };
        return res.status(200).send(new ServerResponse(false, 
          obj, 
          // `Trial users cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please upgrade to add more members.`
        )
      );
      }
    }

    /**
           * Checks life_time_deal (AppSumo) user team member limit based on redeemed coupon codes
           */
    if (subscriptionData.subscription_status === "life_time_deal" && subscriptionData.is_ltd) {
      const currentLtdMembers = parseInt(subscriptionData.current_count) || 0;
      const ltdLimit = parseInt(subscriptionData.ltd_users) || 0;

      if (currentLtdMembers + 1 > ltdLimit) {
        const obj = {
          error_code: 'SEAT_LIMIT_EXCEEDED',
          seats_enough: false,
          current_members: currentLtdMembers,
          plan_seat_limit: ltdLimit,
          business_plan_limit: APPSUMO_PLAN_LIMIT,
          is_appsumo_user: true,
          subscription_type: subscriptionData.subscription_type,
          current_seat_amount: ltdLimit,
        };
        return res
          .status(200)
          .send(
            new ServerResponse(
              false,
              obj,
              // `Your AppSumo plan includes ${ltdLimit} members. Deactivate an inactive member to invite someone new, or upgrade to Business for ${BUSINESS_PLAN_LIMIT} members.`,
            ),
          );
      }
    }

    // Skip limit checks if team_member_limit_override is enabled
    if (subscriptionData.team_member_limit_override !== true) {
      // Check Business plan limits first - Business plans override AppSumo lifetime limits
      if (!userExists && !subscriptionData.is_credit && !subscriptionData.is_custom && subscriptionData.subscription_status !== "trialing") {
        // if (subscriptionData.subscription_status === "active") {
        //   const response = await updateUsers(subscriptionData.subscription_id, (subscriptionData.quantity + 1));
        //   if (!response.body.subscription_id) return res.status(200).send(new ServerResponse(false, null, response.message || "Unable to add user! Please check your subscription."));
        // }
        const updatedCount = parseInt(subscriptionData.current_count) + 1;
        const effectiveUserLimit = getTeamMemberSeatLimit(subscriptionData);
        const requiredSeats = updatedCount - effectiveUserLimit;
        if (updatedCount > effectiveUserLimit) {
          // Check if this is an AppSumo user for specialized modal
          const isAppSumoUser = subscriptionData.is_ltd === true;

          const obj = {
            error_code: 'SEAT_LIMIT_EXCEEDED',
            seats_enough: false,
            required_count: requiredSeats,
            current_members: parseInt(subscriptionData.current_count),
            plan_seat_limit: effectiveUserLimit,
            business_plan_limit: APPSUMO_PLAN_LIMIT,
            is_appsumo_user: isAppSumoUser,
            subscription_type: subscriptionData.subscription_type,
            current_seat_amount: effectiveUserLimit,
          };
          return res.status(200).send(new ServerResponse(
            false,
            obj,
            // isAppSumoUser
            //   ? `Your AppSumo plan includes ${effectiveUserLimit} members. Deactivate an inactive member to invite someone new, or upgrade to Business for ${BUSINESS_PLAN_LIMIT} members.`
            //   : `Insufficient seats available. You need ${requiredSeats} more seat${requiredSeats > 1 ? 's' : ''} to add this member. Please upgrade your subscription.`
          ));
        }
      }

      // Check AppSumo lifetime limits - only applies if not on Business plan
      const isBusinessPlan = subscriptionData.subscription_type === 'ANNUAL_BUSINESS' ||
        subscriptionData.plan_name?.toLowerCase().includes("business") ||
        subscriptionData.business_plan_override === true ||
        subscriptionData.appsumo_business_eligible === true;
      if (!userExists && subscriptionData.is_ltd && subscriptionData.current_count && !isBusinessPlan && (parseInt(subscriptionData.current_count) + 1 > parseInt(subscriptionData.ltd_users))) {
        const ltdLimit = parseInt(subscriptionData.ltd_users);
        const obj = {
          error_code: 'SEAT_LIMIT_EXCEEDED',
          seats_enough: false,
          current_members: parseInt(subscriptionData.current_count),
          plan_seat_limit: ltdLimit,
          business_plan_limit: APPSUMO_PLAN_LIMIT,
          is_appsumo_user: true,
          subscription_type: subscriptionData.subscription_type,
          current_seat_amount: ltdLimit,
        };
        return res.status(200).send(new ServerResponse(false, 
          obj, 
          // `Your AppSumo plan includes ${ltdLimit} members. Deactivate an inactive member to invite someone new, or upgrade to Business for ${BUSINESS_PLAN_LIMIT} members.`
        ));
      }
    }

    // Adding as a team member
    const teamMemberReq: { team_id?: string; emails: string[], project_id?: string; role_name?: string; is_admin?: boolean; job_title_id?: string; } = {
      team_id: req.user?.team_id,
      emails: [req.body.email]
    };

    if (req.body.project_id)
      teamMemberReq.project_id = req.body.project_id;

    // Pass role information for team member creation
    if (req.body.role_name)
      teamMemberReq.role_name = req.body.role_name;
    if (req.body.is_admin !== undefined)
      teamMemberReq.is_admin = req.body.is_admin;
    if (req.body.job_title_id)
      teamMemberReq.job_title_id = req.body.job_title_id;

    const [member] = await TeamMembersController.createOrInviteMembers(teamMemberReq, req.user);

    if (!member)
      return res.status(200).send(new ServerResponse(false, null, "Failed to add the member to the project. Please try again."));

    // Adding to the project - default to MEMBER access level
    // Access level can be changed later if needed
    const projectMemberReq = {
      team_member_id: member.team_member_id,
      team_id: req.user?.team_id,
      project_id: req.body.project_id,
      user_id: req.user?.id,
      access_level: "MEMBER" // Always default to MEMBER for new invitations
    };
    const data = await this.createOrInviteMembers(projectMemberReq);
    return res.status(200).send(new ServerResponse(true, data.member));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT project_members.id,
             tm.id AS team_member_id,
             tm.user_id,
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

  // Project Invitation Links Methods

  @HandleExceptions()
  public static async generateProjectInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, access_level = 'MEMBER', job_title_id, role_name = 'MEMBER', is_admin = false, max_usage = null } = req.body;
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId || !project_id) {
      return res.status(200).send(new ServerResponse(false, null, "Required fields are missing."));
    }

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT p.id, p.name 
      FROM projects p 
      WHERE p.id = $1 AND p.team_id = $2
    `;
    const projectResult = await db.query(projectAccessQuery, [project_id, teamId]);

    if (projectResult.rows.length === 0) {
      return res.status(200).send(new ServerResponse(false, null, "Project not found or access denied."));
    }

    const [project] = projectResult.rows;

    // Check subscription status
    const subscriptionData = await business.featureGate.getTeamSubscription(teamId);

    // Handle self-hosted subscriptions - allow link generation
    if (subscriptionData.subscription_type === 'SELF_HOSTED') {
      // Self-hosted can generate links without restrictions
    } else {
      // Check if subscription status is valid
      if (statusExclude.includes(subscriptionData.subscription_status)) {
        return res.status(200).send(new ServerResponse(false, null, "Unable to generate invitation link! Please check your subscription status."));
      }

      // Skip limit checks if team_member_limit_override is enabled
      if (subscriptionData.team_member_limit_override !== true) {
        // Check trial user limit - warn if close to limit (skip for Business plan trials)
        if (subscriptionData.subscription_status === "trialing") {
            const currentTrialMembers = parseInt(subscriptionData.current_count) || 0;
            if (currentTrialMembers >= TRIAL_MEMBER_LIMIT) {
              const obj = {
                error_code: 'SEAT_LIMIT_EXCEEDED',
                seats_enough: false,
                current_members: currentTrialMembers,
                plan_seat_limit: TRIAL_MEMBER_LIMIT,
                business_plan_limit: 25,
                is_appsumo_user: false,
                subscription_type: subscriptionData.subscription_type,
                current_seat_amount: TRIAL_MEMBER_LIMIT,
              };
              return res.status(200).send(new ServerResponse(false, 
                obj, 
                // `Trial users cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please upgrade to add more members.`
              )
            );
            }
        }

        // Check life_time_deal (AppSumo) user limit for link generation
        if (subscriptionData.subscription_status === "life_time_deal" && subscriptionData.is_ltd) {
          const currentLtdMembers = parseInt(subscriptionData.current_count) || 0;
          const ltdLimit = parseInt(subscriptionData.ltd_users) || 0;

          if (currentLtdMembers >= ltdLimit) {
            const obj = {
              error_code: 'SEAT_LIMIT_EXCEEDED',
              seats_enough: false,
              current_members: currentLtdMembers,
              plan_seat_limit: ltdLimit,
              business_plan_limit: APPSUMO_PLAN_LIMIT,
              is_appsumo_user: true,
              subscription_type: subscriptionData.subscription_type,
              current_seat_amount: ltdLimit,
            };
            return res
              .status(200)
              .send(
                new ServerResponse(
                  false,
                  obj,
                  // `Your AppSumo plan includes ${ltdLimit} members. Deactivate an inactive member to invite someone new, or upgrade to Business for ${BUSINESS_PLAN_LIMIT} members.`,
                ),
              );
          }
        }

        // Check seat availability for active subscriptions (Business plans override LTD limits)
        if (!subscriptionData.is_credit && !subscriptionData.is_custom && subscriptionData.subscription_status === "active") {
          const currentCount = parseInt(subscriptionData.current_count) || 0;
          const effectiveUserLimit = getTeamMemberSeatLimit(subscriptionData);
          if (currentCount >= effectiveUserLimit) {
            const requiredSeats = 1; // At least 1 more seat needed
            const isAppSumoUser = subscriptionData.is_ltd === true;

            const obj = {
              error_code: 'SEAT_LIMIT_EXCEEDED',
              seats_enough: false,
              required_count: requiredSeats,
              current_members: currentCount,
              plan_seat_limit: effectiveUserLimit,
              business_plan_limit: APPSUMO_PLAN_LIMIT,
              is_appsumo_user: isAppSumoUser,
              subscription_type: subscriptionData.subscription_type,
              current_seat_amount: effectiveUserLimit,
            };
            return res.status(200).send(new ServerResponse(
              false,
              obj,
              // isAppSumoUser
              //   ? `Your AppSumo plan includes ${effectiveUserLimit} members. Deactivate an inactive member to invite someone new, or upgrade to Business for ${BUSINESS_PLAN_LIMIT} members.`
              //   : "Insufficient seats available. Please upgrade your subscription before generating invitation links."
            ));
          }
        }

        // Check LTD user limits - only applies if not on Business plan (check both subscription_type and plan_name)
        const isBusinessPlan = subscriptionData.subscription_type === 'ANNUAL_BUSINESS' ||
          subscriptionData.plan_name?.toLowerCase().includes("business") ||
          subscriptionData.business_plan_override === true ||
          subscriptionData.appsumo_business_eligible === true;
        if (subscriptionData.is_ltd && subscriptionData.current_count && !isBusinessPlan) {
          const currentCount = parseInt(subscriptionData.current_count) || 0;
          const ltdLimit = parseInt(subscriptionData.ltd_users) || 0;
          if (currentCount >= ltdLimit) {
            const obj = {
              error_code: 'SEAT_LIMIT_EXCEEDED',
              seats_enough: false,
              current_members: currentCount,
              plan_seat_limit: ltdLimit,
              business_plan_limit: APPSUMO_PLAN_LIMIT,
              is_appsumo_user: true,
              subscription_type: subscriptionData.subscription_type,
              current_seat_amount: ltdLimit,
            };
            return res.status(200).send(new ServerResponse(false, 
              obj, 
              // `Your AppSumo plan includes ${ltdLimit} members. Deactivate an inactive member to invite someone new, or upgrade to Business for ${BUSINESS_PLAN_LIMIT} members.`
            ));
          }
        }
      }
    }

    try {
      // Check if an active and non-expired link already exists for this project
      const checkQuery = `
        SELECT id, token, expires_at, created_at, status
        FROM project_invitation_links
        WHERE project_id = $1 AND status = 'active' AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const checkResult = await db.query(checkQuery, [project_id]);

      let invitationLink;
      let message = "Project invitation link generated successfully";

      if (checkResult.rows.length > 0) {
        // Active and non-expired link exists, return it
        invitationLink = checkResult.rows[0];
        message = "Active invitation link already exists";
      } else {
        // Check if there's an inactive or expired link we can reactivate
        const inactiveQuery = `
          SELECT id, token, expires_at, created_at, status
          FROM project_invitation_links
          WHERE project_id = $1 AND (status != 'active' OR expires_at <= NOW())
          ORDER BY created_at DESC
          LIMIT 1
        `;
        const inactiveResult = await db.query(inactiveQuery, [project_id]);

        // Generate a secure token
        const token = crypto.randomBytes(32).toString('hex');

        // Set expiration to 7 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        if (inactiveResult.rows.length > 0) {
          // Update existing inactive link
          const updateQuery = `
            UPDATE project_invitation_links 
            SET token = $2, created_by = $3, expires_at = $4, access_level = $5,
                job_title_id = $6, role_name = $7, is_admin = $8, max_usage = $9,
                status = 'active', usage_count = 0, updated_at = NOW()
            WHERE id = $1
            RETURNING id, token, expires_at, created_at
          `;

          const result = await db.query(updateQuery, [
            inactiveResult.rows[0].id, token, userId, expiresAt, access_level,
            job_title_id, role_name, is_admin, max_usage
          ]);

          invitationLink = result.rows[0];
          message = "Project invitation link generated successfully";
        } else {
          // Create new invitation link
          const insertQuery = `
            INSERT INTO project_invitation_links (
              project_id, team_id, token, created_by, expires_at, 
              access_level, job_title_id, role_name, is_admin, max_usage
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, token, expires_at, created_at
          `;

          const result = await db.query(insertQuery, [
            project_id, teamId, token, userId, expiresAt,
            access_level, job_title_id, role_name, is_admin, max_usage
          ]);

          invitationLink = result.rows[0];
        }
      }

      // Generate the full invitation URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const invitationUrl = `${baseUrl}/invite/project/${invitationLink.token}`;

      return res.status(200).send(new ServerResponse(true, {
        ...invitationLink,
        invitation_url: invitationUrl,
        project_name: project.name,
        expires_in_days: 7
      }, message));

    } catch (error) {
      console.error('Error generating project invitation link:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to generate invitation link. Please try again."));
    }
  }

  @HandleExceptions()
  public static async validateProjectInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { token } = req.params;

    if (!token) {
      return res.status(200).send(new ServerResponse(false, null, "Invalid invitation link."));
    }

    try {
      const q = `SELECT * FROM validate_invitation_link($1, 'project')`;
      const result = await db.query(q, [token]);
      const [validation] = result.rows;

      if (!validation.is_valid) {
        return res.status(200).send(new ServerResponse(false, null, validation.error_message));
      }

      // Get project and team information
      const projectQuery = `
        SELECT p.id, p.name, p.color_code, t.name as team_name, u.name as owner_name
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE p.id = $1
      `;
      const projectResult = await db.query(projectQuery, [validation.project_id]);
      const [project] = projectResult.rows;

      return res.status(200).send(new ServerResponse(true, {
        project,
        invitation: {
          expires_at: validation.expires_at,
          access_level: validation.access_level,
          job_title_id: validation.job_title_id,
          role_name: validation.role_name,
          is_admin: validation.is_admin
        }
      }));

    } catch (error) {
      console.error('Error validating project invitation link:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to validate invitation link."));
    }
  }

  @HandleExceptions()
  public static async acceptProjectInvitationByLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { token } = req.params;
    const { name, email } = req.body;
    const userId = req.user?.id;

    if (!token || !name || !email) {
      return res.status(200).send(new ServerResponse(false, null, "Required fields are missing."));
    }

    try {
      // Validate the invitation link
      const validationQuery = `SELECT * FROM validate_invitation_link($1, 'project')`;
      const validationResult = await db.query(validationQuery, [token]);
      const [validation] = validationResult.rows;

      if (!validation.is_valid) {
        return res.status(200).send(new ServerResponse(false, null, validation.error_message));
      }

      const teamId = validation.team_id;
      const projectId = validation.project_id;

      // Get team owner ID for checking user existence
      const ownerQuery = `
        SELECT u.id, u.name, t.name as team_name, t.user_id as owner_id
        FROM teams t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = $1
      `;
      const ownerResult = await db.query(ownerQuery, [teamId]);
      const [owner] = ownerResult.rows;

      // Check if user already exists in the team
      let teamMemberId = null;
      let userExistsInTeam = false;

      if (userId) {
        const existingMemberQuery = `
          SELECT id FROM team_members 
          WHERE user_id = $1 AND team_id = $2
        `;
        const existingResult = await db.query(existingMemberQuery, [userId, teamId]);
        if (existingResult.rows.length > 0) {
          teamMemberId = existingResult.rows[0].id;
          userExistsInTeam = true;
        }
      }

      // Check if email already exists in the team
      if (!teamMemberId) {
        const emailExistsQuery = `
          SELECT team_member_id FROM team_member_info_view 
          WHERE email = $1 AND team_id = $2
        `;
        const emailResult = await db.query(emailExistsQuery, [email, teamId]);
        if (emailResult.rows.length > 0) {
          teamMemberId = emailResult.rows[0].team_member_id;
          userExistsInTeam = true;
        }
      }

      // Check if user already exists in any team owned by this owner
      const userExists = await this.checkIfUserAlreadyExists(owner.owner_id, email);

      // Determine if this will increment the user count (only if creating new team member)
      let incrementBy = 0;
      if (!userExistsInTeam && !userExists) {
        incrementBy = 1;
      }

      // Check subscription status for the target team
      const subscriptionData = await business.featureGate.getTeamSubscription(teamId);

      // Handle self-hosted subscriptions
      if (subscriptionData.subscription_type === 'SELF_HOSTED') {
        // Self-hosted can accept invitations without restrictions
      } else {
        // Check if subscription status is valid
        if (statusExclude.includes(subscriptionData.subscription_status)) {
          return res.status(200).send(new ServerResponse(false, null, "Unable to join project! Please check team subscription status."));
        }

        // Skip limit checks if team_member_limit_override is enabled
        if (subscriptionData.team_member_limit_override !== true) {
          // Check seat availability for active subscriptions (Business plans override LTD limits)
          if (!subscriptionData.is_credit && !subscriptionData.is_custom && subscriptionData.subscription_status === "active") {
            const updatedCount = parseInt(subscriptionData.current_count) + incrementBy;
            const effectiveUserLimit = getTeamMemberSeatLimit(subscriptionData);
            const requiredSeats = updatedCount - effectiveUserLimit;
            if (updatedCount > effectiveUserLimit) {
              const obj = {
                seats_enough: false,
                required_count: requiredSeats,
                current_seat_amount: effectiveUserLimit
              };
              return res.status(200).send(new ServerResponse(false, obj, `Insufficient seats available. The team needs ${requiredSeats} more seat${requiredSeats > 1 ? 's' : ''} to add you. Please ask the team owner to upgrade.`));
            }
          }

          // Check LTD user limits - only applies if not on Business plan
          // Business plans (via ANNUAL_BUSINESS subscription type OR plan_name containing "business") override LTD limits
          const isBusinessPlanProjectLink = subscriptionData.subscription_type === 'ANNUAL_BUSINESS' ||
            subscriptionData.plan_name?.toLowerCase().includes("business") ||
            subscriptionData.business_plan_override === true ||
            subscriptionData.appsumo_business_eligible === true;

          if (incrementBy > 0 && subscriptionData.is_ltd && subscriptionData.current_count && !isBusinessPlanProjectLink) {
            const currentCount = parseInt(subscriptionData.current_count) || 0;
            const ltdLimit = parseInt(subscriptionData.ltd_users) || 0;
            if (currentCount + incrementBy > ltdLimit) {
              return res.status(200).send(new ServerResponse(false, null, "Cannot exceed the maximum number of lifetime users. Please ask the team owner to upgrade."));
            }
          }

          // Check trial member limit
          if (subscriptionData.subscription_status === "trialing") {
            const currentTrialMembers = parseInt(subscriptionData.current_count) || 0;
            if (currentTrialMembers + incrementBy > TRIAL_MEMBER_LIMIT) {
              return res.status(200).send(new ServerResponse(false, null, `Trial teams cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please ask the team owner to upgrade.`));
            }
          }

          if (subscriptionData.subscription_status === "life_time_deal" && subscriptionData.is_ltd) {
            const currentLtdMembers = parseInt(subscriptionData.current_count) || 0;
            const ltdLimit = parseInt(subscriptionData.ltd_users) || 0;

            if (currentLtdMembers >= ltdLimit) {
              return res
                .status(200)
                .send(
                  new ServerResponse(
                    false,
                    null,
                    `The team cannot exceed ${ltdLimit} team members.Please ask the team owner to upgrade.`,
                  ),
                );
            }
          }
        }
      }

      // If user doesn't exist in team, create team member first
      if (!teamMemberId) {
        const memberData = {
          team_id: teamId,
          emails: [email],
          names: [name],
          job_title_id: validation.job_title_id,
          role_name: validation.role_name,
          is_admin: validation.is_admin,
          user_id: userId
        };

        const mockUser: IPassportSession = {
          id: owner.id,
          name: owner.name,
          team_id: teamId,
          team_name: owner.team_name,
          owner_id: owner.owner_id
        } as IPassportSession;

        const newMembers = await TeamMembersController.createOrInviteMembers(memberData, mockUser);
        if (newMembers && newMembers.length > 0) {
          teamMemberId = newMembers[0].team_member_id;
        }
      }

      if (!teamMemberId) {
        return res.status(200).send(new ServerResponse(false, null, "Failed to create team member."));
      }

      // Check if already a project member
      const existingProjectMemberQuery = `
        SELECT id FROM project_members 
        WHERE team_member_id = $1 AND project_id = $2
      `;
      const existingProjectResult = await db.query(existingProjectMemberQuery, [teamMemberId, projectId]);

      if (existingProjectResult.rows.length > 0) {
        // Set the joined team as active for the user
        if (userId) {
          const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
          await db.query(setActiveTeamQuery, [userId, teamId]);
        }
        return res.status(200).send(new ServerResponse(true, { team_id: teamId, project_id: projectId }, "You are already a member of this project."));
      }

      // Add to project
      const projectMemberData = {
        team_member_id: teamMemberId,
        team_id: teamId,
        project_id: projectId,
        user_id: userId,
        access_level: validation.access_level
      };

      const projectMemberResult = await this.createOrInviteMembers(projectMemberData);

      // Record the invitation link usage
      if (projectMemberResult) {
        const usageQuery = `
          INSERT INTO invitation_link_usage (
            project_invitation_link_id, user_id, team_member_id, project_member_id,
            email, name, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        const ipAddress = req.ip || req.connection?.remoteAddress;
        const userAgent = req.get('User-Agent');

        await db.query(usageQuery, [
          validation.link_id, userId, teamMemberId, projectMemberResult.member?.id,
          email, name, ipAddress, userAgent
        ]);

        // Set the joined team as active for the user
        if (userId) {
          const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
          await db.query(setActiveTeamQuery, [userId, teamId]);
        }
      }

      return res.status(200).send(new ServerResponse(true, { team_id: teamId, project_id: projectId, member: projectMemberResult }, "Successfully joined the project!"));

    } catch (error) {
      console.error('Error accepting project invitation:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to join project. Please try again."));
    }
  }

  @HandleExceptions()
  public static async revokeProjectInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id } = req.body;
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId || !project_id) {
      return res.status(200).send(new ServerResponse(false, null, "Required fields are missing."));
    }

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT id FROM projects 
      WHERE id = $1 AND team_id = $2
    `;
    const projectResult = await db.query(projectAccessQuery, [project_id, teamId]);

    if (projectResult.rows.length === 0) {
      return res.status(200).send(new ServerResponse(false, null, "Project not found or access denied."));
    }

    try {
      const q = `
        UPDATE project_invitation_links 
        SET status = 'revoked', updated_at = NOW()
        WHERE project_id = $1 AND status = 'active'
        RETURNING id
      `;

      const result = await db.query(q, [project_id]);

      if (result.rows.length === 0) {
        return res.status(200).send(new ServerResponse(false, null, "No active invitation link found."));
      }

      return res.status(200).send(new ServerResponse(true, null, "Project invitation link has been deactivated."));

    } catch (error) {
      console.error('Error revoking project invitation link:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to deactivate invitation link."));
    }
  }

  @HandleExceptions()
  public static async getProjectInvitationLinkStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id } = req.query;
    const teamId = req.user?.team_id;

    if (!teamId || !project_id) {
      return res.status(200).send(new ServerResponse(false, null, "Required fields are missing."));
    }

    // Check if user has access to the project
    const projectAccessQuery = `
      SELECT id, name FROM projects 
      WHERE id = $1 AND team_id = $2
    `;
    const projectResult = await db.query(projectAccessQuery, [project_id, teamId]);

    if (projectResult.rows.length === 0) {
      return res.status(200).send(new ServerResponse(false, null, "Project not found or access denied."));
    }

    const [project] = projectResult.rows;

    try {
      const q = `
        SELECT id, token, expires_at, status, usage_count, max_usage, created_at, access_level
        FROM project_invitation_links
        WHERE project_id = $1 AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await db.query(q, [project_id]);

      if (result.rows.length === 0) {
        return res.status(200).send(new ServerResponse(true, {
          has_active_link: false,
          project_name: project.name
        }));
      }

      const [link] = result.rows;
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const invitationUrl = `${baseUrl}/invite/project/${link.token}`;

      return res.status(200).send(new ServerResponse(true, {
        has_active_link: true,
        invitation_url: invitationUrl,
        expires_at: link.expires_at,
        usage_count: link.usage_count,
        max_usage: link.max_usage,
        created_at: link.created_at,
        access_level: link.access_level,
        project_name: project.name
      }));

    } catch (error) {
      console.error('Error getting project invitation link status:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to get invitation link status."));
    }
  }
}
