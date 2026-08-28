import { checkTeamSubscriptionStatus, getActiveGuestCount } from "../ee/shared/paddle-utils";
import {
  FREE_GUEST_LIMIT,
  PRO_GUEST_LIMIT,
  APPSUMO_LTD_GUEST_LIMIT,
  BUSINESS_GUEST_LIMIT,
  SELF_HOSTED_GUEST_LIMIT
} from "./constants";
import { log_error } from "./utils";

const APPSUMO_BUSINESS_UNLOCK_CODE_COUNT = 5;

export interface IGuestLimitInfo {
  plan_tier: string;
  guest_limit: number; // -1 = unlimited
  current_guest_count: number;
  remaining_slots: number;
  can_add_guest: boolean;
  error_message?: string;
}

/**
 * Get guest seat limit information for a workspace
 * Determines the guest limit based on subscription tier and current guest count
 *
 * IMPORTANT: Guest members do NOT count towards regular team member seat limits.
 * This function only checks guest-specific limits based on plan tier.
 * 
 * Plan-based guest limits:
 * - FREE/TRIAL: 0 guests (no guest access)
 * - PROFESSIONAL: 5 guests
 * - APPSUMO_LTD (1-4 codes): 5 guests
 * - APPSUMO_BUSINESS (5+ codes): Unlimited guests
 * - BUSINESS/SELF_HOSTED: Unlimited guests
 *
 * @param teamId - The team/workspace ID
 * @returns IGuestLimitInfo with limit info and current usage
 */
export async function getGuestSeatLimit(teamId: string): Promise<IGuestLimitInfo> {
  try {
    const subscriptionData = await checkTeamSubscriptionStatus(teamId);
    const currentGuestCount = await getActiveGuestCount(teamId);

    // Determine limit based on subscription type
    let guestLimit = FREE_GUEST_LIMIT;
    let planTier = "FREE";

    if (subscriptionData?.subscription_type === "SELF_HOSTED") {
      guestLimit = SELF_HOSTED_GUEST_LIMIT;
      planTier = "SELF_HOSTED";
    } else if (
      subscriptionData?.subscription_type === "ANNUAL_BUSINESS" ||
      subscriptionData?.business_plan_override === true ||
      subscriptionData?.plan_name?.toLowerCase().includes("business")
    ) {
      guestLimit = BUSINESS_GUEST_LIMIT;
      planTier = "BUSINESS";
    } else if (
      subscriptionData?.subscription_type === "LIFE_TIME_DEAL" &&
      subscriptionData?.redeemed_codes_count >= APPSUMO_BUSINESS_UNLOCK_CODE_COUNT
    ) {
      // AppSumo LTD users with 5+ redeemed codes get Business plan features (unlimited guests)
      guestLimit = BUSINESS_GUEST_LIMIT; // -1 = unlimited
      planTier = "APPSUMO_BUSINESS";
    } else if (
      subscriptionData?.subscription_type === "LIFE_TIME_DEAL"
    ) {
      // AppSumo LTD users with 1-4 codes get limited guest access (5 guests)
      // Guests don't count towards seat limits, but are limited to 5
      guestLimit = APPSUMO_LTD_GUEST_LIMIT; // 5 guests
      planTier = "APPSUMO_LTD";
    } else if (
      subscriptionData?.subscription_type === "PADDLE" &&
      subscriptionData?.plan_name?.toLowerCase().includes("professional")
    ) {
      guestLimit = PRO_GUEST_LIMIT;
      planTier = "PROFESSIONAL";
    } else if (
      subscriptionData?.subscription_status === "trialing" ||
      subscriptionData?.subscription_type === "TRIAL"
    ) {
      guestLimit = FREE_GUEST_LIMIT;
      planTier = "TRIAL";
    } else {
      guestLimit = FREE_GUEST_LIMIT;
      planTier = "FREE";
    }

    const remaining =
      guestLimit === -1 ? -1 : Math.max(0, guestLimit - currentGuestCount);
    const canAdd = guestLimit === -1 || currentGuestCount < guestLimit;

    let errorMessage: string | undefined;
    if (!canAdd) {
      if (guestLimit === 0) {
        errorMessage = `Your ${planTier} plan does not include guest access. Upgrade to Professional or Business to add guests.`;
      } else {
        errorMessage = `Your ${planTier} plan includes ${guestLimit} guest${guestLimit === 1 ? "" : "s"}. Upgrade to add more guests.`;
      }
    }

    return {
      plan_tier: planTier,
      guest_limit: guestLimit,
      current_guest_count: currentGuestCount,
      remaining_slots: remaining,
      can_add_guest: canAdd,
      error_message: errorMessage
    };
  } catch (error) {
    log_error(error);
    return {
      plan_tier: "UNKNOWN",
      guest_limit: 0,
      current_guest_count: 0,
      remaining_slots: 0,
      can_add_guest: false,
      error_message: "Failed to determine guest limit"
    };
  }
}

/**
 * Verify that a guest can be added to a workspace
 * Returns false if the workspace has reached its guest limit
 *
 * @param teamId - The team/workspace ID
 * @returns boolean - True if a guest can be added, false otherwise
 */
export async function canAddGuest(teamId: string): Promise<boolean> {
  try {
    const limitInfo = await getGuestSeatLimit(teamId);
    return limitInfo.can_add_guest;
  } catch (error) {
    log_error(error);
    return false;
  }
}

/**
 * Get the guest limit for a specific plan tier
 * Useful for displaying limits in UI without querying subscription data
 *
 * @param planTier - The plan tier ('FREE', 'PROFESSIONAL', 'BUSINESS', etc.)
 * @returns number - The guest limit (-1 for unlimited, 0 for no guests)
 */
export function getGuestLimitByTier(planTier: string): number {
  switch (planTier.toUpperCase()) {
    case "PROFESSIONAL":
      return PRO_GUEST_LIMIT; // Unlimited
    case "BUSINESS":
      return BUSINESS_GUEST_LIMIT; // Unlimited
    case "ENTERPRISE":
      return BUSINESS_GUEST_LIMIT; // Unlimited
    case "SELF_HOSTED":
      return SELF_HOSTED_GUEST_LIMIT; // Unlimited
    case "APPSUMO_BUSINESS":
      return BUSINESS_GUEST_LIMIT; // Unlimited (5+ codes)
    case "APPSUMO_LTD":
      return APPSUMO_LTD_GUEST_LIMIT; // 5 guests (1-4 codes)
    case "FREE":
    case "TRIAL":
    default:
      return FREE_GUEST_LIMIT;
  }
}
