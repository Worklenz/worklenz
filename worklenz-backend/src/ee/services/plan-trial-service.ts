import db from "../../config/db";
import { log_error } from "../../shared/utils";
import { ServerResponse } from "../../models/server-response";

export interface IPlanTrialInfo {
  trial_id?: string;
  plan_tier_id?: string;
  tier_name?: string;
  display_name?: string;
  trial_end_date?: Date;
  days_remaining?: number;
  can_start_trial?: boolean;
  trial_duration_days?: number;
}

export interface IPlanTrialStartRequest {
  user_id: string;
  organization_id: string;
  plan_tier_name: string;
}

export interface IPlanTrialConversionData {
  trial_id: string;
  converted_to_paid: boolean;
  conversion_date?: Date;
}

export class PlanTrialService {
  /**
   * Check if user can start a trial for a specific plan
   */
  public static async canStartPlanTrial(userId: string, planTierName: string): Promise<boolean> {
    try {
      const result = await db.query(
        `SELECT can_start_plan_trial($1,
          (SELECT id FROM licensing_plan_tiers WHERE tier_name = $2 AND trial_enabled = TRUE)
        ) AS can_start`,
        [userId, planTierName]
      );

      return result.rows[0]?.can_start || false;
    } catch (error) {
      log_error(error);
      return false;
    }
  }

  /**
   * Get plan trial information for a specific plan
   */
  public static async getPlanTrialInfo(userId: string, planTierName: string): Promise<IPlanTrialInfo> {
    try {
      // Check for existing active trial
      const activeTrialResult = await db.query(
        `SELECT
          pt.id AS trial_id,
          pt.plan_tier_id,
          pt.trial_end_date,
          lpt.tier_name,
          lpt.display_name,
          GREATEST(0, EXTRACT(DAY FROM (pt.trial_end_date - NOW()))::INTEGER) AS days_remaining
        FROM licensing_plan_trials pt
        JOIN licensing_plan_tiers lpt ON lpt.id = pt.plan_tier_id
        WHERE pt.user_id = $1
          AND lpt.tier_name = $2
          AND pt.is_active = TRUE
          AND pt.trial_end_date > NOW()`,
        [userId, planTierName]
      );

      if (activeTrialResult.rows.length > 0) {
        return activeTrialResult.rows[0];
      }

      // Check if trial is available for this plan
      const planInfoResult = await db.query(
        `SELECT
          id AS plan_tier_id,
          tier_name,
          display_name,
          trial_duration_days,
          trial_enabled
        FROM licensing_plan_tiers
        WHERE tier_name = $1`,
        [planTierName]
      );

      if (planInfoResult.rows.length === 0) {
        return { can_start_trial: false };
      }

      const planInfo = planInfoResult.rows[0];

      // Check if user can start trial
      const canStart = await this.canStartPlanTrial(userId, planTierName);

      return {
        plan_tier_id: planInfo.plan_tier_id,
        tier_name: planInfo.tier_name,
        display_name: planInfo.display_name,
        trial_duration_days: planInfo.trial_duration_days,
        can_start_trial: canStart && planInfo.trial_enabled
      };
    } catch (error) {
      log_error(error);
      return { can_start_trial: false };
    }
  }

  /**
   * Start a plan trial for a user
   */
  public static async startPlanTrial(request: IPlanTrialStartRequest): Promise<ServerResponse<any>> {
    try {
      // Get plan tier ID
      const planResult = await db.query(
        `SELECT id, trial_duration_days, display_name
         FROM licensing_plan_tiers
         WHERE tier_name = $1 AND trial_enabled = TRUE`,
        [request.plan_tier_name]
      );

      if (planResult.rows.length === 0) {
        return new ServerResponse(false, null, "Trial not available for this plan");
      }

      const planTierId = planResult.rows[0].id;
      const trialDays = planResult.rows[0].trial_duration_days;
      const displayName = planResult.rows[0].display_name;

      // Check if user can start trial
      const canStart = await this.canStartPlanTrial(request.user_id, request.plan_tier_name);
      if (!canStart) {
        return new ServerResponse(false, null, "You have already used the trial for this plan");
      }

      // Start the trial
      const result = await db.query(
        `SELECT start_plan_trial($1, $2, $3) AS trial_id`,
        [request.user_id, request.organization_id, planTierId]
      );

      const trialId = result.rows[0]?.trial_id;

      if (!trialId) {
        return new ServerResponse(false, null, "Failed to start trial");
      }

      // Calculate trial end date
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + trialDays);

      return new ServerResponse(true, {
        trial_id: trialId,
        plan_name: displayName,
        trial_days: trialDays,
        trial_end_date: endDate,
        message: `Your ${trialDays}-day ${displayName} trial has started!`
      });
    } catch (error) {
      log_error(error);
      return new ServerResponse(false, null, "Failed to start trial");
    }
  }

  /**
   * Get active plan trial for a user
   */
  public static async getActivePlanTrial(userId: string): Promise<IPlanTrialInfo | null> {
    try {
      const result = await db.query(
        `SELECT * FROM get_active_plan_trial($1)`,
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      log_error(error);
      return null;
    }
  }

  /**
   * Cancel an active plan trial
   */
  public static async cancelPlanTrial(userId: string, reason?: string): Promise<ServerResponse<any>> {
    try {
      const result = await db.query(
        `UPDATE licensing_plan_trials
         SET is_active = FALSE,
             cancellation_reason = $2,
             updated_at = NOW()
         WHERE user_id = $1
           AND is_active = TRUE
         RETURNING id`,
        [userId, reason]
      );

      if (result.rows.length === 0) {
        return new ServerResponse(false, null, "No active trial found");
      }

      return new ServerResponse(true, { message: "Trial cancelled successfully" });
    } catch (error) {
      log_error(error);
      return new ServerResponse(false, null, "Failed to cancel trial");
    }
  }

  /**
   * Cancel an active plan trial for a specific tier (e.g. BUSINESS_LARGE)
   */
  public static async cancelPlanTrialByTier(
    userId: string,
    planTierName: string,
    reason?: string
  ): Promise<ServerResponse<any>> {
    try {
      const result = await db.query(
        `UPDATE licensing_plan_trials pt
         SET is_active = FALSE,
             cancellation_reason = $3,
             updated_at = NOW()
         FROM licensing_plan_tiers lpt
         WHERE pt.user_id = $1
           AND pt.is_active = TRUE
           AND lpt.id = pt.plan_tier_id
           AND lpt.tier_name = $2
         RETURNING pt.id`,
        [userId, planTierName, reason]
      );

      if (result.rows.length === 0) {
        return new ServerResponse(false, null, "No active trial found");
      }

      return new ServerResponse(true, { message: "Trial cancelled successfully" });
    } catch (error) {
      log_error(error);
      return new ServerResponse(false, null, "Failed to cancel trial");
    }
  }

  /**
   * Convert trial to paid subscription
   */
  public static async convertTrialToPaid(userId: string, trialId: string): Promise<ServerResponse<any>> {
    try {
      const result = await db.query(
        `UPDATE licensing_plan_trials
         SET converted_to_paid = TRUE,
             conversion_date = NOW(),
             is_active = FALSE,
             updated_at = NOW()
         WHERE user_id = $1
           AND id = $2
           AND is_active = TRUE
         RETURNING id, plan_tier_id`,
        [userId, trialId]
      );

      if (result.rows.length === 0) {
        return new ServerResponse(false, null, "Trial not found or already converted");
      }

      return new ServerResponse(true, {
        message: "Trial converted successfully",
        plan_tier_id: result.rows[0].plan_tier_id
      });
    } catch (error) {
      log_error(error);
      return new ServerResponse(false, null, "Failed to convert trial");
    }
  }

  /**
   * Expire overdue trials (called by scheduled job)
   */
  public static async expireOverdueTrials(): Promise<number> {
    try {
      const result = await db.query(
        `UPDATE licensing_plan_trials
         SET is_active = FALSE,
             updated_at = NOW()
         WHERE is_active = TRUE
           AND trial_end_date < NOW()
         RETURNING id`
      );

      const expiredCount = result.rows.length;

      if (expiredCount > 0) {
        console.log(`Expired ${expiredCount} overdue plan trials`);
      }

      return expiredCount;
    } catch (error) {
      log_error(error);
      return 0;
    }
  }

  /**
   * Get trials expiring soon (for reminder emails)
   */
  public static async getTrialsExpiringSoon(hoursBeforeExpiry: number = 24): Promise<any[]> {
    try {
      const result = await db.query(
        `SELECT
          pt.id,
          pt.user_id,
          pt.trial_end_date,
          u.email,
          u.name AS user_name,
          lpt.display_name AS plan_name,
          EXTRACT(HOUR FROM (pt.trial_end_date - NOW())) AS hours_remaining
        FROM licensing_plan_trials pt
        JOIN users u ON u.id = pt.user_id
        JOIN licensing_plan_tiers lpt ON lpt.id = pt.plan_tier_id
        WHERE pt.is_active = TRUE
          AND pt.trial_end_date > NOW()
          AND pt.trial_end_date <= NOW() + INTERVAL '${hoursBeforeExpiry} hours'
          AND NOT pt.converted_to_paid
          AND u.is_deleted IS NOT TRUE`,
        []
      );

      return result.rows;
    } catch (error) {
      log_error(error);
      return [];
    }
  }

  /**
   * Get trial conversion analytics
   */
  public static async getTrialConversionStats(planTierName?: string): Promise<any> {
    try {
      let query = `
        SELECT
          lpt.tier_name,
          lpt.display_name,
          COUNT(*) AS total_trials,
          COUNT(CASE WHEN pt.converted_to_paid THEN 1 END) AS converted_trials,
          ROUND(COUNT(CASE WHEN pt.converted_to_paid THEN 1 END) * 100.0 / COUNT(*), 2) AS conversion_rate,
          AVG(CASE
            WHEN pt.converted_to_paid
            THEN EXTRACT(EPOCH FROM (pt.conversion_date - pt.trial_start_date)) / 86400
            ELSE NULL
          END)::NUMERIC(10,2) AS avg_days_to_convert
        FROM licensing_plan_trials pt
        JOIN licensing_plan_tiers lpt ON lpt.id = pt.plan_tier_id
      `;

      const params: any[] = [];

      if (planTierName) {
        query += ` WHERE lpt.tier_name = $1`;
        params.push(planTierName);
      }

      query += ` GROUP BY lpt.tier_name, lpt.display_name`;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      log_error(error);
      return [];
    }
  }
}
