import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../../controllers/worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { PlanTrialService } from "../services/plan-trial-service";
import { appSumoLtdEntitlementService } from "../../shared/private-extensions";

export default class PlanTrialController extends WorklenzControllerBase {
  /**
   * Check if user can start a trial for Business plan
   * GET /api/plans/business/trial/eligibility
   */
  @HandleExceptions()
  public static async checkBusinessTrialEligibility(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.owner_id || req.user?.id;

    if (!userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const unlockCount = appSumoLtdEntitlementService.getBusinessUnlockCodeCount();
      const entitlement = await appSumoLtdEntitlementService.getEntitlementForUser(userId);

      const trialInfo = await PlanTrialService.getPlanTrialInfo(userId, "BUSINESS_LARGE");

      // AppSumo LTD users don't get to start a *new* Business trial on demand:
      // - < 5 codes: they should buy/redeem more codes to unlock Business
      // - >= 5 codes: Business is already unlocked
      // An already-active trial (e.g. from signup) is left running regardless of
      // AppSumo redemption; it must not be cancelled here.
      if (entitlement.is_ltd && !trialInfo.trial_id) {
        return res.status(200).send(
          new ServerResponse(true, {
            can_start_trial: false,
            redeemed_codes_count: entitlement.redeemed_codes_count,
            required_codes_for_business: unlockCount,
            appsumo_business_eligible: entitlement.appsumo_business_eligible,
          })
        );
      }

      return res.status(200).send(new ServerResponse(true, trialInfo));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to check trial eligibility"));
    }
  }

  /**
   * Start Business plan trial
   * POST /api/plans/business/trial
   */
  @HandleExceptions()
  public static async startBusinessTrial(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.owner_id || req.user?.id;
    const organizationId = req.user?.organization_id;

    if (!userId || !organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const unlockCount = appSumoLtdEntitlementService.getBusinessUnlockCodeCount();
      const entitlement = await appSumoLtdEntitlementService.getEntitlementForUser(userId);

      // AppSumo LTD users can't start a *new* Business trial on demand. An
      // already-active trial (e.g. from signup) is left running and is not
      // cancelled here.
      if (entitlement.is_ltd) {
        const existingTrial = await PlanTrialService.getPlanTrialInfo(userId, "BUSINESS_LARGE");
        if (existingTrial.trial_id) {
          return res.status(400).send(new ServerResponse(false, null, "You already have an active Business trial"));
        }

        if (entitlement.redeemed_codes_count >= unlockCount) {
          return res
            .status(400)
            .send(new ServerResponse(false, null, "Business plan is already unlocked for your AppSumo account"));
        }

        return res
          .status(403)
          .send(new ServerResponse(false, null, `Redeem ${unlockCount} AppSumo codes to unlock Business plan features`));
      }

      // Check if user is already on a paid business plan
      // Note: We'll check subscription status from the session or database
      // For now, allow trial regardless of current plan
      // const currentSubscriptionType = req.user?.subscription_type;
      // if (currentSubscriptionType === "PADDLE" && req.user?.plan_name?.toLowerCase().includes("business")) {
      //   return res.status(400).send(new ServerResponse(false, null, "You are already on a Business plan"));
      // }

      const result = await PlanTrialService.startPlanTrial({
        user_id: userId,
        organization_id: organizationId,
        plan_tier_name: "BUSINESS_LARGE"
      });

      if (!result.done) {
        return res.status(400).send(result);
      }

      // Log analytics event
      this.logTrialStartEvent(userId, "BUSINESS_LARGE");

      return res.status(200).send(result);
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to start trial"));
    }
  }

  /**
   * Get active plan trial status
   * GET /api/plans/trial/status
   */
  @HandleExceptions()
  public static async getTrialStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.owner_id || req.user?.id;

    if (!userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const activeTrial = await PlanTrialService.getActivePlanTrial(userId);

      return res.status(200).send(new ServerResponse(true, {
        has_active_trial: !!activeTrial,
        trial_info: activeTrial
      }));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to get trial status"));
    }
  }

  /**
   * Cancel active plan trial
   * POST /api/plans/trial/cancel
   */
  @HandleExceptions()
  public static async cancelTrial(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const result = await PlanTrialService.cancelPlanTrial(userId, reason);

      if (result.done) {
        // Log analytics event
        this.logTrialCancelEvent(userId, reason);
      }

      return res.status(result.done ? 200 : 400).send(result);
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to cancel trial"));
    }
  }

  /**
   * Convert trial to paid subscription (called after successful Paddle checkout)
   * POST /api/plans/trial/convert
   */
  @HandleExceptions()
  public static async convertTrial(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const { trial_id } = req.body;

    if (!userId || !trial_id) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    try {
      const result = await PlanTrialService.convertTrialToPaid(userId, trial_id);

      if (result.done) {
        // Log analytics event
        this.logTrialConversionEvent(userId, trial_id);
      }

      return res.status(result.done ? 200 : 400).send(result);
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to convert trial"));
    }
  }

  /**
   * Get trial conversion statistics (admin only)
   * GET /api/plans/trial/stats
   */
  @HandleExceptions()
  public static async getTrialStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const isAdmin = req.user?.is_admin;

    if (!isAdmin) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    try {
      const { plan } = req.query;
      const stats = await PlanTrialService.getTrialConversionStats(plan as string);

      return res.status(200).send(new ServerResponse(true, stats));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to get trial statistics"));
    }
  }

  // Analytics helper methods
  private static logTrialStartEvent(userId: string, planName: string): void {
    try {      // Log to database for analytics
      this.logTrialEvent(userId, "trial_started", { plan_name: planName });
    } catch (error) {
      // Don't fail the request if analytics fails
      console.error("Failed to log trial start event:", error);
    }
  }

  private static logTrialCancelEvent(userId: string, reason?: string): void {
    try {
      // Log to database for analytics
      this.logTrialEvent(userId, "trial_cancelled", {
        reason: reason || "Not specified"
      });
    } catch (error) {
      console.error("Failed to log trial cancel event:", error);
    }
  }

  private static logTrialConversionEvent(userId: string, trialId: string): void {
    try {
      // Log to database for analytics
      this.logTrialEvent(userId, "trial_converted", {
        trial_id: trialId
      });
    } catch (error) {
      console.error("Failed to log trial conversion event:", error);
    }
  }

  /**
   * Log trial events to database for analytics
   */
  private static async logTrialEvent(userId: string, eventType: string, metadata: any): Promise<void> {
    try {
      // You can create a dedicated analytics events table or use existing activity logs
      // For now, just log to console with structured format for analysis
      const analyticsEvent = {
        user_id: userId,
        event_type: eventType,
        event_category: "plan_trial",
        metadata,
        timestamp: new Date().toISOString(),
        source: "backend"
      };
    } catch (error) {
      console.error("Failed to log trial analytics event:", error);
    }
  }
}
