import {
  getGuestSeatLimit,
  canAddGuest,
  getGuestLimitByTier
} from "../shared/guest-seat-limits";
import * as paddleUtils from "../ee/shared/paddle-utils";
import * as utils from "../shared/utils";

jest.mock("../ee/shared/paddle-utils");
jest.mock("../shared/utils", () => ({
  log_error: jest.fn()
}));

describe("guest-seat-limits", () => {
  const teamId = "c8f5f4b0-3940-42f0-8c29-873b22cf3100";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getGuestSeatLimit", () => {
    it("should return unlimited guests for SELF_HOSTED tier", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "SELF_HOSTED"
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(12);

      const result = await getGuestSeatLimit(teamId);

      expect(result).toEqual({
        plan_tier: "SELF_HOSTED",
        guest_limit: -1,
        current_guest_count: 12,
        remaining_slots: -1,
        can_add_guest: true,
        error_message: undefined
      });
    });

    it("should return unlimited guests for ANNUAL_BUSINESS tier", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "ANNUAL_BUSINESS"
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(4);

      const result = await getGuestSeatLimit(teamId);

      expect(result.plan_tier).toBe("BUSINESS");
      expect(result.guest_limit).toBe(-1);
      expect(result.can_add_guest).toBe(true);
      expect(result.remaining_slots).toBe(-1);
    });

    it("should return unlimited guests if business_plan_override is true", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "PADDLE",
        business_plan_override: true
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(0);

      const result = await getGuestSeatLimit(teamId);

      expect(result.plan_tier).toBe("BUSINESS");
      expect(result.guest_limit).toBe(-1);
      expect(result.can_add_guest).toBe(true);
    });

    it("should return unlimited guests if plan_name contains business", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "PADDLE",
        plan_name: "Worklenz Business Monthly"
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(2);

      const result = await getGuestSeatLimit(teamId);

      expect(result.plan_tier).toBe("BUSINESS");
      expect(result.guest_limit).toBe(-1);
      expect(result.can_add_guest).toBe(true);
    });

    it("should return APPSUMO_BUSINESS (unlimited) for LIFE_TIME_DEAL with 5 or more codes", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "LIFE_TIME_DEAL",
        redeemed_codes_count: 5
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(8);

      const result = await getGuestSeatLimit(teamId);

      expect(result.plan_tier).toBe("APPSUMO_BUSINESS");
      expect(result.guest_limit).toBe(-1);
      expect(result.can_add_guest).toBe(true);
      expect(result.remaining_slots).toBe(-1);
    });

    it("should return APPSUMO_LTD with 5 limit for LIFE_TIME_DEAL with 1-4 codes when slots remain", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "LIFE_TIME_DEAL",
        redeemed_codes_count: 2
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(3);

      const result = await getGuestSeatLimit(teamId);

      expect(result).toEqual({
        plan_tier: "APPSUMO_LTD",
        guest_limit: 5,
        current_guest_count: 3,
        remaining_slots: 2,
        can_add_guest: true,
        error_message: undefined
      });
    });

    it("should disallow adding guest when APPSUMO_LTD reaches limit of 5", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "LIFE_TIME_DEAL",
        redeemed_codes_count: 1
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(5);

      const result = await getGuestSeatLimit(teamId);

      expect(result).toEqual({
        plan_tier: "APPSUMO_LTD",
        guest_limit: 5,
        current_guest_count: 5,
        remaining_slots: 0,
        can_add_guest: false,
        error_message: "Your APPSUMO_LTD plan includes 5 guests. Upgrade to add more guests."
      });
    });

    it("should return PROFESSIONAL tier with 5 guest limit", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "PADDLE",
        plan_name: "Worklenz Professional Annual"
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(4);

      const result = await getGuestSeatLimit(teamId);

      expect(result).toEqual({
        plan_tier: "PROFESSIONAL",
        guest_limit: 5,
        current_guest_count: 4,
        remaining_slots: 1,
        can_add_guest: true,
        error_message: undefined
      });
    });

    it("should disallow guest addition for TRIAL plan (limit 0)", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_status: "trialing",
        subscription_type: "TRIAL"
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(0);

      const result = await getGuestSeatLimit(teamId);

      expect(result).toEqual({
        plan_tier: "TRIAL",
        guest_limit: 0,
        current_guest_count: 0,
        remaining_slots: 0,
        can_add_guest: false,
        error_message: "Your TRIAL plan does not include guest access. Upgrade to Professional or Business to add guests."
      });
    });

    it("should fallback to FREE plan (limit 0) when subscription status is null/unrecognized", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue(null);
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(0);

      const result = await getGuestSeatLimit(teamId);

      expect(result.plan_tier).toBe("FREE");
      expect(result.guest_limit).toBe(0);
      expect(result.can_add_guest).toBe(false);
      expect(result.error_message).toContain("Your FREE plan does not include guest access.");
    });

    it("should handle exceptions and return safe fallback object", async () => {
      const dbError = new Error("Database connection lost");
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockRejectedValue(dbError);

      const result = await getGuestSeatLimit(teamId);

      expect(utils.log_error).toHaveBeenCalledWith(dbError);
      expect(result).toEqual({
        plan_tier: "UNKNOWN",
        guest_limit: 0,
        current_guest_count: 0,
        remaining_slots: 0,
        can_add_guest: false,
        error_message: "Failed to determine guest limit"
      });
    });
  });

  describe("canAddGuest", () => {
    it("should return true when getGuestSeatLimit allows adding guests", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "SELF_HOSTED"
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(2);

      const allowed = await canAddGuest(teamId);
      expect(allowed).toBe(true);
    });

    it("should return false when getGuestSeatLimit disallows adding guests", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockResolvedValue({
        subscription_type: "TRIAL"
      });
      (paddleUtils.getActiveGuestCount as jest.Mock).mockResolvedValue(0);

      const allowed = await canAddGuest(teamId);
      expect(allowed).toBe(false);
    });

    it("should return false when getGuestSeatLimit throws an unhandled error", async () => {
      (paddleUtils.checkTeamSubscriptionStatus as jest.Mock).mockImplementation(() => {
        throw new Error("Fatal crash");
      });

      const allowed = await canAddGuest(teamId);
      expect(allowed).toBe(false);
      expect(utils.log_error).toHaveBeenCalled();
    });
  });

  describe("getGuestLimitByTier", () => {
    it("should return -1 for BUSINESS, ENTERPRISE, SELF_HOSTED, and APPSUMO_BUSINESS", () => {
      expect(getGuestLimitByTier("BUSINESS")).toBe(-1);
      expect(getGuestLimitByTier("ENTERPRISE")).toBe(-1);
      expect(getGuestLimitByTier("SELF_HOSTED")).toBe(-1);
      expect(getGuestLimitByTier("APPSUMO_BUSINESS")).toBe(-1);
    });

    it("should return 5 for PROFESSIONAL and APPSUMO_LTD", () => {
      expect(getGuestLimitByTier("PROFESSIONAL")).toBe(5);
      expect(getGuestLimitByTier("APPSUMO_LTD")).toBe(5);
    });

    it("should return 0 for FREE, TRIAL, and any unknown tiers", () => {
      expect(getGuestLimitByTier("FREE")).toBe(0);
      expect(getGuestLimitByTier("TRIAL")).toBe(0);
      expect(getGuestLimitByTier("nonexistent_tier")).toBe(0);
    });

    it("should be case-insensitive", () => {
      expect(getGuestLimitByTier("business")).toBe(-1);
      expect(getGuestLimitByTier("professional")).toBe(5);
      expect(getGuestLimitByTier("appsumo_ltd")).toBe(5);
    });
  });
});
