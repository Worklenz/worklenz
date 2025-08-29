import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {
  calculateMonthDays,
  getColor,
  log_error,
  megabytesToBytes,
} from "../shared/utils";
import moment from "moment";
import { calculateStorage } from "../shared/s3";
import {
  checkTeamSubscriptionStatus,
  getActiveTeamMemberCount,
  getCurrentProjectsCount,
  getFreePlanSettings,
  getOwnerIdByTeam,
  getTeamMemberCount,
  getUsedStorage,
} from "../shared/paddle-utils";
import { AppSumoService } from "../services/appsumo-service";
import {
  addModifier,
  cancelSubscription,
  changePlan,
  generatePayLinkRequest,
  pauseOrResumeSubscription,
  updateUsers,
} from "../shared/paddle-requests";
import { statusExclude } from "../shared/constants";
import { NotificationsService } from "../services/notifications/notifications.service";
import { SocketEvents } from "../socket.io/events";
import { IO } from "../shared/io";

export default class AdminCenterController extends WorklenzControllerBase {
  public static async checkIfUserActiveInOtherTeams(
    owner_id: string,
    email: string
  ) {
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
  public static async getOrganizationDetails(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
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
                      (SELECT name FROM users WHERE id = organizations.user_id) AS owner_name,
                      calculation_method,
                      hours_per_day
                  FROM organizations
                  WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getAdminCenterSettings(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT organization_name                                      AS name,
                      contact_number,
                      contact_number_secondary,
                      calculation_method,
                      hours_per_day,
                      (SELECT email FROM users WHERE id = organizations.user_id),
                      (SELECT name FROM users WHERE id = organizations.user_id) AS owner_name
                  FROM organizations
                  WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getOrganizationAdmins(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
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
  public static async getOrganizationUsers(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { searchQuery, size, offset } = this.toPaginationOptions(req.query, [
      "outer_tmiv.name",
      "outer_tmiv.email",
    ]);

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
  public static async updateOrganizationName(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { name } = req.body;
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
  public static async updateOwnerContactNumber(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { contact_number } = req.body;
    const q = `UPDATE organizations
               SET contact_number = $1
               WHERE user_id = $2;`;
    const result = await db.query(q, [contact_number, req.user?.owner_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateOrganizationCalculationMethod(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { calculation_method, hours_per_day } = req.body;

    // Validate calculation method
    if (!["hourly", "man_days"].includes(calculation_method)) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Invalid calculation method. Must be \"hourly\" or \"man_days\""
          )
        );
    }

    const updateQuery = `
      UPDATE organizations 
      SET calculation_method = $1, 
          hours_per_day = COALESCE($2, hours_per_day),
          updated_at = NOW()
      WHERE user_id = $3
      RETURNING id, organization_name, calculation_method, hours_per_day;
    `;

    const result = await db.query(updateQuery, [
      calculation_method,
      hours_per_day,
      req.user?.owner_id,
    ]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Organization not found"));
    }

    return res.status(200).send(
      new ServerResponse(true, {
        organization: result.rows[0],
        message: "Organization calculation method updated successfully",
      })
    );
  }

  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = ``;
    const result = await db.query(q, []);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getOrganizationTeams(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { searchQuery, size, offset } = this.toPaginationOptions(req.query, [
      "name",
    ]);

    let size_changed = size;

    if (offset == 0) size_changed = size_changed - 1;

    const currentTeamClosure =
      offset == 0
        ? `,
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
                                  WHERE user_id = $1 AND teams.id = $4) c) AS current_team_data`
        : ``;

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
    const result = await db.query(q, [
      req.user?.owner_id,
      size_changed,
      offset,
      req.user?.team_id,
    ]);

    const [obj] = result.rows;

    for (const team of obj.teams?.data || []) {
      team.names = this.createTagList(team?.team_members);
      team.names.map((a: any) => (a.color_code = getColor(a.name)));
    }

    if (obj.teams.current_team_data) {
      obj.teams.current_team_data.names = this.createTagList(
        obj.teams.current_team_data?.team_members
      );
      obj.teams.current_team_data.names.map(
        (a: any) => (a.color_code = getColor(a.name))
      );
    }

    return res.status(200).send(new ServerResponse(true, obj.teams || {}));
  }

  @HandleExceptions()
  public static async getTeamDetails(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;

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
                                    r.name AS role_name,
                                    EXISTS(SELECT email
                                           FROM email_invitations
                                           WHERE team_member_id = tm.id
                                             AND email_invitations.team_id = tm.team_id) AS pending_invitation
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
    obj.names.map((a: any) => (a.color_code = getColor(a.name)));

    return res.status(200).send(new ServerResponse(true, obj || {}));
  }

  @HandleExceptions()
  public static async updateTeam(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { name, teamMembers } = req.body;

    try {
      // Update team name
      const updateNameQuery = `UPDATE teams SET name = $1 WHERE id = $2 RETURNING id;`;
      const nameResult = await db.query(updateNameQuery, [name, id]);

      if (!nameResult.rows.length) {
        return res
          .status(404)
          .send(new ServerResponse(false, null, "Team not found"));
      }

      // Update team member roles if provided
      if (teamMembers?.length) {
        // Use Promise.all to handle all role updates concurrently
        await Promise.all(
          teamMembers.map(
            async (member: { role_name: string; user_id: string }) => {
              const roleQuery = `
            UPDATE team_members 
            SET role_id = (SELECT id FROM roles WHERE roles.team_id = $1 AND name = $2)
            WHERE user_id = $3 AND team_id = $1
            RETURNING id;`;
              await db.query(roleQuery, [id, member.role_name, member.user_id]);
            }
          )
        );
      }

      return res
        .status(200)
        .send(new ServerResponse(true, null, "Team updated successfully"));
    } catch (error) {
      log_error("Error updating team:", error);
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to update team"));
    }
  }

  @HandleExceptions()
  public static async getBillingInfo(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT get_billing_info($1) AS billing_info;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    const validTillDate = moment(data.billing_info.trial_expire_date);

    const daysDifference = validTillDate.diff(moment(), "days");
    const dateString = calculateMonthDays(
      moment().format("YYYY-MM-DD"),
      data.billing_info.trial_expire_date
    );

    data.billing_info.expire_date_string = dateString;

    if (daysDifference < 0) {
      data.billing_info.expire_date_string = `Your trial plan expired ${dateString} ago`;
    } else if (daysDifference === 0 && daysDifference < 7) {
      data.billing_info.expire_date_string = `Your trial plan expires today`;
    } else {
      data.billing_info.expire_date_string = `Your trial plan expires in ${dateString}.`;
    }

    if (data.billing_info.billing_type === "year")
      data.billing_info.unit_price_per_month =
        data.billing_info.unit_price / 12;

    const teamMemberData = await getTeamMemberCount(req.user?.owner_id ?? "");
    const subscriptionData = await checkTeamSubscriptionStatus(
      req.user?.team_id ?? ""
    );

    data.billing_info.total_used = teamMemberData.user_count;
    data.billing_info.total_seats = subscriptionData.quantity;

    return res.status(200).send(new ServerResponse(true, data.billing_info));
  }

  @HandleExceptions()
  public static async getBillingTransactions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT subscription_payment_id,
                      event_time::date,
                      (next_bill_date::DATE - INTERVAL '1 day')::DATE AS next_bill_date,
                      currency,
                      receipt_url,
                      payment_method,
                      status,
                      payment_status
               FROM licensing_payment_details
               WHERE user_id = $1
               ORDER BY created_at DESC;`;
    const result = await db.query(q, [req.user?.owner_id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getBillingCharges(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT (SELECT name FROM licensing_pricing_plans lpp WHERE id = lus.plan_id),
                      unit_price::numeric,
                      currency,
                      status,
                      quantity,
                      unit_price::numeric * quantity                  AS amount,
                      (SELECT event_time
                       FROM licensing_payment_details lpd
                       WHERE lpd.user_id = lus.user_id
                       ORDER BY created_at DESC
                       LIMIT 1)::DATE                                 AS start_date,
                      (next_bill_date::DATE - INTERVAL '1 day')::DATE AS end_date
               FROM licensing_user_subscriptions lus
               WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);

    const countQ = `SELECT subscription_id
                    FROM licensing_user_subscription_modifiers
                    WHERE subscription_id = (SELECT subscription_id
                                             FROM licensing_user_subscriptions
                                             WHERE user_id = $1
                                               AND status != 'deleted'
                                             LIMIT 1)::INT;`;
    const countResult = await db.query(countQ, [req.user?.owner_id]);

    return res.status(200).send(
      new ServerResponse(true, {
        plan_charges: result.rows,
        modifiers: countResult.rows,
      })
    );
  }

  @HandleExceptions()
  public static async getBillingModifiers(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT created_at
               FROM licensing_user_subscription_modifiers
               WHERE subscription_id = (SELECT subscription_id
                                        FROM licensing_user_subscriptions
                                        WHERE user_id = $1
                                          AND status != 'deleted'
                                        LIMIT 1)::INT;`;
    const result = await db.query(q, [req.user?.owner_id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getBillingConfiguration(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT name,
                      email,
                      organization_name AS company_name,
                      contact_number    AS phone,
                      address_line_1,
                      address_line_2,
                      city,
                      state,
                      postal_code,
                      country
               FROM organizations
                      LEFT JOIN users u ON organizations.user_id = u.id
               WHERE u.id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateBillingConfiguration(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const {
      company_name,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      country,
    } = req.body;
    const q = `UPDATE organizations
               SET organization_name = $1,
                   contact_number    = $2,
                   address_line_1    = $3,
                   address_line_2    = $4,
                   city              = $5,
                   state             = $6,
                   postal_code       = $7,
                   country           = $8
               WHERE user_id = $9;`;
    const result = await db.query(q, [
      company_name,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      country,
      req.user?.owner_id,
    ]);
    const [data] = result.rows;

    return res
      .status(200)
      .send(new ServerResponse(true, data, "Configuration Updated"));
  }

  @HandleExceptions()
  public static async upgradePlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { plan } = req.query;

    const obj = await getTeamMemberCount(req.user?.owner_id ?? "");
    const axiosResponse = await generatePayLinkRequest(
      obj,
      plan as string,
      req.user?.owner_id,
      req.user?.id
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async getPlans(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT
                  ls.default_monthly_plan AS monthly_plan_id,
                  lp_monthly.name AS monthly_plan_name,
                  ls.default_annual_plan AS annual_plan_id,
                  lp_monthly.recurring_price AS monthly_price,
                  lp_annual.name AS annual_plan_name,
                  lp_annual.recurring_price AS annual_price,
                  ls.team_member_limit,
                  ls.projects_limit,
                  ls.free_tier_storage
              FROM
                  licensing_settings ls
              LEFT JOIN
                  licensing_pricing_plans lp_monthly ON ls.default_monthly_plan = lp_monthly.id
              LEFT JOIN
                  licensing_pricing_plans lp_annual ON ls.default_annual_plan = lp_annual.id;`;
    const result = await db.query(q, []);
    const [data] = result.rows;

    const obj = await getTeamMemberCount(req.user?.owner_id ?? "");

    // If no data found, return default values
    if (!data) {
      const defaultData = {
        monthly_plan_id: null,
        monthly_plan_name: "Pro Monthly",
        annual_plan_id: null,
        annual_plan_name: "Pro Annual",
        monthly_price: "69",
        annual_price: "49",
        team_member_limit: "3",
        projects_limit: "3",
        free_tier_storage: "100MB",
        current_user_count: obj.user_count
      };
      
      return res.status(200).send(new ServerResponse(true, defaultData));
    }

    // Safely handle data transformation with null checks
    const responseData = {
      ...data,
      team_member_limit: data.team_member_limit === 0 ? "Unlimited" : (data.team_member_limit || "3"),
      projects_limit: data.projects_limit === 0 ? "Unlimited" : (data.projects_limit || "3"),
      free_tier_storage: data.free_tier_storage ? `${data.free_tier_storage}MB` : "100MB",
      current_user_count: obj.user_count,
      annual_price: data.annual_price ? (data.annual_price / 12).toFixed(2) : "49",
      monthly_price: data.monthly_price || "69"
    };

    return res.status(200).send(new ServerResponse(true, responseData));
  }

  @HandleExceptions()
  public static async purchaseStorage(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT subscription_id
               FROM licensing_user_subscriptions lus
               WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    await addModifier(data.subscription_id);

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async changePlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { plan } = req.query;

    const q = `SELECT subscription_id
               FROM licensing_user_subscriptions lus
               WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    const axiosResponse = await changePlan(
      plan as string,
      data.subscription_id
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async cancelPlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user?.owner_id)
      return res
        .status(200)
        .send(new ServerResponse(false, "Invalid Request."));

    const q = `SELECT subscription_id
               FROM licensing_user_subscriptions lus
               WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    const axiosResponse = await cancelSubscription(
      data.subscription_id,
      req.user?.owner_id
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async pauseSubscription(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user?.owner_id)
      return res
        .status(200)
        .send(new ServerResponse(false, "Invalid Request."));

    const q = `SELECT subscription_id
               FROM licensing_user_subscriptions lus
               WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    const axiosResponse = await pauseOrResumeSubscription(
      data.subscription_id,
      req.user?.owner_id,
      true
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async resumeSubscription(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user?.owner_id)
      return res
        .status(200)
        .send(new ServerResponse(false, "Invalid Request."));

    const q = `SELECT subscription_id
               FROM licensing_user_subscriptions lus
               WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    const axiosResponse = await pauseOrResumeSubscription(
      data.subscription_id,
      req.user?.owner_id,
      false
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async getBillingStorageInfo(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT trial_in_progress,
                      trial_expire_date,
                      ud.storage,
                      (SELECT name AS plan_name FROM licensing_pricing_plans WHERE id = lus.plan_id),
                      (SELECT default_trial_storage FROM licensing_settings),
                      (SELECT storage_addon_size FROM licensing_settings),
                      (SELECT storage_addon_price FROM licensing_settings)
               FROM organizations ud
                      LEFT JOIN users u ON ud.user_id = u.id
                      LEFT JOIN licensing_user_subscriptions lus ON u.id = lus.user_id
               WHERE ud.user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getAccountStorage(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamsQ = `SELECT id
                    FROM teams
                    WHERE user_id = $1;`;
    const teamsResponse = await db.query(teamsQ, [req.user?.owner_id]);

    const storageQ = `SELECT storage
                      FROM organizations
                      WHERE user_id = $1;`;
    const result = await db.query(storageQ, [req.user?.owner_id]);
    const [data] = result.rows;

    const storage: any = {};
    storage.used = 0;
    storage.total = data.storage;

    for (const team of teamsResponse.rows) {
      storage.used += await calculateStorage(team.id);
    }

    storage.remaining = storage.total * 1024 * 1024 * 1024 - storage.used;
    storage.used_percent =
      Math.ceil((storage.used / (storage.total * 1024 * 1024 * 1024)) * 10000) /
      100;

    return res.status(200).send(new ServerResponse(true, storage));
  }

  @HandleExceptions()
  public static async getCountries(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, code
               FROM countries
               ORDER BY name;`;
    const result = await db.query(q, []);

    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async switchToFreePlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id: teamId } = req.params;

    const limits = await getFreePlanSettings();
    const ownerId = await getOwnerIdByTeam(teamId);

    if (limits && ownerId) {
      if (parseInt(limits.team_member_limit) !== 0) {
        const teamMemberCount = await getTeamMemberCount(ownerId);
        if (parseInt(teamMemberCount) > parseInt(limits.team_member_limit)) {
          return res
            .status(200)
            .send(
              new ServerResponse(
                false,
                [],
                `Sorry, the free plan cannot have more than ${limits.team_member_limit} members.`
              )
            );
        }
      }

      const projectsCount = await getCurrentProjectsCount(ownerId);
      if (parseInt(projectsCount) > parseInt(limits.projects_limit)) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              false,
              [],
              `Sorry, the free plan cannot have more than ${limits.projects_limit} projects.`
            )
          );
      }

      const usedStorage = await getUsedStorage(ownerId);
      if (
        parseInt(usedStorage) >
        megabytesToBytes(parseInt(limits.free_tier_storage))
      ) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              false,
              [],
              `Sorry, the free plan cannot exceed ${limits.free_tier_storage}MB of storage.`
            )
          );
      }

      const update_q = `UPDATE organizations
        SET license_type_id     = (SELECT id FROM sys_license_types WHERE key = 'FREE'),
            trial_in_progress   = FALSE,
            subscription_status = 'free',
            storage             = (SELECT free_tier_storage FROM licensing_settings)
        WHERE user_id = $1;`;
      await db.query(update_q, [ownerId]);

      return res
        .status(200)
        .send(
          new ServerResponse(
            true,
            [],
            "Your plan has been successfully switched to the Free Plan."
          )
        );
    }
    return res
      .status(200)
      .send(
        new ServerResponse(
          false,
          [],
          "Failed to switch to the Free Plan. Please try again later."
        )
      );
  }

  @HandleExceptions()
  public static async redeem(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { code } = req.body;

    const q = `SELECT * FROM licensing_coupon_codes WHERE coupon_code = $1 AND is_redeemed IS FALSE AND is_refunded IS FALSE;`;
    const result = await db.query(q, [code]);
    const [data] = result.rows;

    if (!result.rows.length)
      return res
        .status(200)
        .send(
          new ServerResponse(
            false,
            [],
            "Redeem Code verification Failed! Please try again."
          )
        );

    const checkQ = `SELECT  sum(team_members_limit) AS team_member_total FROM licensing_coupon_codes WHERE redeemed_by = $1 AND is_redeemed IS TRUE;`;
    const checkResult = await db.query(checkQ, [req.user?.owner_id]);
    const [total] = checkResult.rows;

    if (parseInt(total.team_member_total) > 50)
      return res
        .status(200)
        .send(
          new ServerResponse(false, [], "Maximum number of codes redeemed!")
        );

    const updateQ = `UPDATE licensing_coupon_codes
                SET is_redeemed  = TRUE, redeemed_at = CURRENT_TIMESTAMP,
                    redeemed_by = $1
                WHERE id = $2;`;
    await db.query(updateQ, [req.user?.owner_id, data.id]);

    const updateQ2 = `UPDATE organizations
        SET subscription_status = 'life_time_deal',
            trial_in_progress   = FALSE,
            storage = (SELECT sum(storage_limit) FROM licensing_coupon_codes WHERE redeemed_by = $1),
            license_type_id = (SELECT id FROM sys_license_types WHERE key = 'LIFE_TIME_DEAL') 
        WHERE user_id = $1;`;
    await db.query(updateQ2, [req.user?.owner_id]);

    return res
      .status(200)
      .send(new ServerResponse(true, [], "Code redeemed successfully!"));
  }

  @HandleExceptions()
  public static async deleteTeam(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    if (id == req.user?.team_id) {
      return res
        .status(200)
        .send(
          new ServerResponse(
            true,
            [],
            "Please switch to another team before attempting deletion."
          ).withTitle("Unable to remove the presently active team!")
        );
    }

    const q = `DELETE FROM teams WHERE id = $1;`;
    const result = await db.query(q, [id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { teamId } = req.body;

    if (!id || !teamId)
      return res
        .status(200)
        .send(new ServerResponse(false, "Required fields are missing."));

    // check subscription status
    const subscriptionData = await checkTeamSubscriptionStatus(teamId);
    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res
        .status(200)
        .send(
          new ServerResponse(false, "Please check your subscription status.")
        );
    }

    const q = `SELECT remove_team_member($1, $2, $3) AS member;`;
    const result = await db.query(q, [id, req.user?.id, teamId]);
    const [data] = result.rows;

    const message = `You have been removed from <b>${req.user?.team_name}</b> by <b>${req.user?.name}</b>`;

    // if (subscriptionData.status === "trialing") break;
    if (!subscriptionData.is_credit && !subscriptionData.is_custom) {
      if (
        subscriptionData.subscription_status === "active" &&
        subscriptionData.quantity > 0
      ) {
        const obj = await getActiveTeamMemberCount(req.user?.owner_id ?? "");

        const userActiveInOtherTeams = await this.checkIfUserActiveInOtherTeams(
          req.user?.owner_id as string,
          req.query?.email as string
        );

        if (!userActiveInOtherTeams) {
          const response = await updateUsers(
            subscriptionData.subscription_id,
            obj.user_count
          );
          if (!response.body.subscription_id)
            return res
              .status(200)
              .send(
                new ServerResponse(
                  false,
                  response.message || "Please check your subscription."
                )
              );
        }
      }
    }

    NotificationsService.sendNotification({
      receiver_socket_id: data.socket_id,
      message,
      team: data.team,
      team_id: id,
    });

    IO.emitByUserId(
      data.member.id,
      req.user?.id || null,
      SocketEvents.TEAM_MEMBER_REMOVED,
      {
        teamId: id,
        message,
      }
    );
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getFreePlanLimits(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const limits = await getFreePlanSettings();

    return res.status(200).send(new ServerResponse(true, limits || {}));
  }

  @HandleExceptions()
  public static async getOrganizationProjects(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { searchQuery, size, offset } = this.toPaginationOptions(req.query, [
      "p.name",
    ]);

    const countQ = `SELECT COUNT(*) AS total
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        JOIN organizations o ON t.organization_id = o.id
        WHERE o.user_id = $1;`;
    const countResult = await db.query(countQ, [req.user?.owner_id]);

    // Query to get the project data
    const dataQ = `SELECT p.id,
            p.name,
            t.name AS team_name,
            p.created_at,
            pm.member_count
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        JOIN organizations o ON t.organization_id = o.id
        LEFT JOIN (
        SELECT project_id, COUNT(*) AS member_count
        FROM project_members
        GROUP BY project_id
        ) pm ON p.id = pm.project_id
        WHERE o.user_id = $1 ${searchQuery}
        ORDER BY p.name
        OFFSET $2 LIMIT $3;`;

    const result = await db.query(dataQ, [req.user?.owner_id, offset, size]);

    const response = {
      total: countResult.rows[0]?.total ?? 0,
      data: result.rows ?? [],
    };

    return res.status(200).send(new ServerResponse(true, response));
  }

  @HandleExceptions()
  public static async getOrganizationHolidaySettings(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT ohs.id, ohs.organization_id, ohs.country_code, ohs.state_code, 
                      ohs.auto_sync_holidays, ohs.created_at, ohs.updated_at
               FROM organization_holiday_settings ohs
               JOIN organizations o ON ohs.organization_id = o.id
               WHERE o.user_id = $1;`;

    const result = await db.query(q, [req.user?.owner_id]);

    // If no settings exist, return default settings
    if (result.rows.length === 0) {
      return res.status(200).send(
        new ServerResponse(true, {
          country_code: null,
          state_code: null,
          auto_sync_holidays: true,
        })
      );
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async updateOrganizationHolidaySettings(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { country_code, state_code, auto_sync_holidays } = req.body;

    // First, get the organization ID
    const orgQ = `SELECT id FROM organizations WHERE user_id = $1;`;
    const orgResult = await db.query(orgQ, [req.user?.owner_id]);

    if (orgResult.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, "Organization not found"));
    }

    const organizationId = orgResult.rows[0].id;

    // Check if settings already exist
    const checkQ = `SELECT id FROM organization_holiday_settings WHERE organization_id = $1;`;
    const checkResult = await db.query(checkQ, [organizationId]);

    let result;
    if (checkResult.rows.length > 0) {
      // Update existing settings
      const updateQ = `UPDATE organization_holiday_settings 
                       SET country_code = $2, 
                           state_code = $3, 
                           auto_sync_holidays = $4,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE organization_id = $1
                       RETURNING *;`;
      result = await db.query(updateQ, [
        organizationId,
        country_code,
        state_code,
        auto_sync_holidays,
      ]);
    } else {
      // Insert new settings
      const insertQ = `INSERT INTO organization_holiday_settings 
                       (organization_id, country_code, state_code, auto_sync_holidays)
                       VALUES ($1, $2, $3, $4)
                       RETURNING *;`;
      result = await db.query(insertQ, [
        organizationId,
        country_code,
        state_code,
        auto_sync_holidays,
      ]);
    }

    // If auto_sync_holidays is enabled and country is Sri Lanka, populate holidays
    if (auto_sync_holidays && country_code === "LK") {
      try {
        // Import the holiday data provider
        const {
          HolidayDataProvider,
        } = require("../services/holiday-data-provider");

        // Get current year and next year to ensure we have recent data
        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear + 1];

        for (const year of years) {
          const sriLankanHolidays =
            await HolidayDataProvider.getSriLankanHolidays(year);

          for (const holiday of sriLankanHolidays) {
            const query = `
              INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (country_code, name, date) DO NOTHING
            `;

            await db.query(query, [
              "LK",
              holiday.name,
              holiday.description,
              holiday.date,
              holiday.is_recurring,
            ]);
          }
        }

        console.log(
          `✅ Automatically populated Sri Lankan holidays for ${years.join(
            ", "
          )}`
        );
      } catch (error) {
        // Log error but don't fail the settings update
        console.error("Error populating Sri Lankan holidays:", error);
      }
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async getCountriesWithStates(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // Get all countries
    const countriesQ = `SELECT code, name FROM countries ORDER BY name;`;
    const countriesResult = await db.query(countriesQ);

    // For now, we'll return a basic structure
    // In a real implementation, you would have a states table
    const countriesWithStates = countriesResult.rows.map((country) => ({
      code: country.code,
      name: country.name,
      states: [] as Array<{ code: string; name: string }>, // Would be populated from a states table
    }));

    // Add some example states for US and Canada
    const usIndex = countriesWithStates.findIndex((c) => c.code === "US");
    if (usIndex !== -1) {
      countriesWithStates[usIndex].states = [
        { code: "CA", name: "California" },
        { code: "NY", name: "New York" },
        { code: "TX", name: "Texas" },
        { code: "FL", name: "Florida" },
        { code: "WA", name: "Washington" },
      ];
    }

    const caIndex = countriesWithStates.findIndex((c) => c.code === "CA");
    if (caIndex !== -1) {
      countriesWithStates[caIndex].states = [
        { code: "ON", name: "Ontario" },
        { code: "QC", name: "Quebec" },
        { code: "BC", name: "British Columbia" },
        { code: "AB", name: "Alberta" },
      ];
    }

    return res.status(200).send(new ServerResponse(true, countriesWithStates));
  }

  /**
   * Get AppSumo countdown widget data
   * GET /api/admin-center/appsumo/countdown-widget
   */
  @HandleExceptions()
  public static async getAppSumoCountdownWidget(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const countdownData = await AppSumoService.getCountdownWidget(organizationId);
      
      if (!countdownData) {
        return res.status(200).send(new ServerResponse(true, {
          isVisible: false,
          remainingDays: 0,
          remainingHours: 0,
          remainingMinutes: 0,
          urgencyLevel: 'normal',
          message: 'Not an AppSumo user or discount period expired',
          ctaText: 'View Plans',
          ctaUrl: '/settings/billing'
        }));
      }

      return res.status(200).send(new ServerResponse(true, countdownData));
    } catch (error) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null, "Failed to get AppSumo countdown widget data"));
    }
  }
}
