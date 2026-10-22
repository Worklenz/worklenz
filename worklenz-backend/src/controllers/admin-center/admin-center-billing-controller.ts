import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { calculateMonthDays, megabytesToBytes } from "../../shared/utils";
import moment from "moment";
import { calculateStorage } from "../../shared/s3";
import {
  checkTeamSubscriptionStatus,
  getActiveTeamMemberCount,
  getCurrentProjectsCount,
  getFreePlanSettings,
  getOwnerIdByTeam,
  getTeamMemberCount,
  getUsedStorage,
  getCurrentSubscriptionRef,
} from "../../shared/paddle-utils";
import { appSumoService } from "../../shared/private-extensions";
import {
  addModifier,
  cancelSubscription,
  changePlan,
  generatePayLinkRequest,
  pauseOrResumeSubscription,
} from "../../shared/paddle-requests";

export default class AdminCenterBillingController extends WorklenzControllerBase {
  private static async getSubscriptionId(ownerId: string): Promise<string> {
    return (await getCurrentSubscriptionRef(ownerId)) as string;
  }

  @HandleExceptions()
  public static async getBillingInfo(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT get_billing_info($1) AS billing_info;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    // Validate that billing_info exists
    if (!data || !data.billing_info) {
      return res.status(200).send(
        new ServerResponse(false, null, "Billing information not found")
      );
    }

    if (data.billing_info.trial_expire_date) {
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
    }

    if (data.billing_info.billing_type === "year")
      data.billing_info.unit_price_per_month =
        data.billing_info.unit_price / 12;

    const teamMemberData = await getActiveTeamMemberCount(req.user?.owner_id ?? "");
    const subscriptionData = await checkTeamSubscriptionStatus(
      req.user?.team_id ?? ""
    );

    const adjustedUsedCount = Number(teamMemberData?.user_count ?? 0);
    const freeSeatCount = Number(teamMemberData?.free_count ?? 0);
    const actualActiveMemberCount = adjustedUsedCount + freeSeatCount;

    // total_used should reflect the actual active members shown in team settings.
    data.billing_info.total_used = Math.max(actualActiveMemberCount, 0);
    const isLtdUser = data.billing_info?.is_ltd_user === true;
    const ltdSeatLimit = Number(subscriptionData?.ltd_users ?? 0);

    data.billing_info.total_seats = isLtdUser
      ? Math.max(ltdSeatLimit, 0)
      : (subscriptionData?.quantity ?? null);
    data.billing_info.redeemed_codes_count = subscriptionData?.redeemed_codes_count ?? 0;
    data.billing_info.appsumo_business_eligible = subscriptionData?.appsumo_business_eligible === true;
    data.billing_info.billing_provider = subscriptionData?.billing_provider ?? null;
    data.billing_info.subscription_ref = subscriptionData?.subscription_ref ?? null;

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
    const { plan, seatCount } = req.query;

    const obj = await getTeamMemberCount(req.user?.owner_id ?? "");
    if (seatCount) {
      obj.user_count = parseInt(seatCount as string, 10);
    }
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
    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    await addModifier(subscriptionId);

    return res.status(200).send(new ServerResponse(true, { subscription_id: subscriptionId }));
  }

  @HandleExceptions()
  public static async changePlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { plan } = req.query;

    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    const axiosResponse = await changePlan(
      plan as string,
      subscriptionId
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

    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    const axiosResponse = await cancelSubscription(
      subscriptionId,
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

    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    const axiosResponse = await pauseOrResumeSubscription(
      subscriptionId,
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

    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    const axiosResponse = await pauseOrResumeSubscription(
      subscriptionId,
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

    // Check if user has redeemed 5 codes and upgrade to Business Plan
    const redeemedCountQ = `SELECT COUNT(*)::INT AS redeemed_count 
                           FROM licensing_coupon_codes 
                           WHERE redeemed_by = $1 
                             AND is_redeemed = TRUE 
                             AND is_refunded = FALSE;`;
    const redeemedResult = await db.query(redeemedCountQ, [req.user?.owner_id]);
    const redeemedCount = redeemedResult.rows[0]?.redeemed_count || 0;

	    if (redeemedCount >= 5) {
	      // Upgrade to Business Plan
	      const businessPlanQ = `UPDATE organizations
	        SET business_plan_override = TRUE,
	            team_member_limit_override = TRUE
	        WHERE user_id = $1;`;
	      await db.query(businessPlanQ, [req.user?.owner_id]);
	    }

    return res
      .status(200)
      .send(new ServerResponse(true, [], "Code redeemed successfully!"));
  }

  @HandleExceptions()
  public static async getFreePlanLimits(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const limits = await getFreePlanSettings();

    return res.status(200).send(new ServerResponse(true, limits || {}));
  }

  /**
   * Get AppSumo countdown widget data
   * GET /api/admin-center/appsumo/countdown-widget
   */
  @HandleExceptions()
  public static async getAppSumoCountdownWidget(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    const countdownData = await appSumoService.getCountdownWidget(organizationId);

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
  }
}
