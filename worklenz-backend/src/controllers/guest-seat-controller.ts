import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { getGuestSeatLimit } from "../shared/guest-seat-limits";
import HandleExceptions from "../decorators/handle-exceptions";
import { log_error } from "../shared/utils";
import WorklenzControllerBase from "./worklenz-controller-base";

/**
 * Controller for guest seat management
 * Provides information about current guest usage and plan limits
 */
export default class GuestSeatController extends WorklenzControllerBase {
  /**
   * Get current guest seat usage and limit for the workspace
   * GET /api/v1/team/guest-usage
   *
   * @param req - Express request with authenticated user
   * @param res - Express response
   * @returns Current guest count, limit, and remaining slots
   */
  @HandleExceptions()
  public static async getUsage(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      const guestLimitInfo = await getGuestSeatLimit(teamId);

      return res.status(200).send(
        new ServerResponse(true, {
          plan_tier: guestLimitInfo.plan_tier,
          guest_limit: guestLimitInfo.guest_limit,
          current_guest_count: guestLimitInfo.current_guest_count,
          remaining_slots: guestLimitInfo.remaining_slots,
          can_add_guest: guestLimitInfo.can_add_guest,
          error_message: guestLimitInfo.error_message,
          upgrade_url: "/settings/billing/plans"
        })
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "Failed to retrieve guest usage information")
      );
    }
  }
}
