import AdminCenterBillingController from "../controllers/admin-center/admin-center-billing-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import {
  checkTeamSubscriptionStatus,
  getActiveTeamMemberCount,
  getCurrentProjectsCount,
  getFreePlanSettings,
  getOwnerIdByTeam,
  getTeamMemberCount,
  getUsedStorage,
  getCurrentSubscriptionRef,
} from "../shared/paddle-utils";
import { calculateStorage } from "../shared/s3";
import {
  addModifier,
  cancelSubscription,
  changePlan,
  generatePayLinkRequest,
  pauseOrResumeSubscription,
} from "../shared/paddle-requests";
import { appSumoService } from "../shared/private-extensions";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../shared/paddle-utils", () => ({
  checkTeamSubscriptionStatus: jest.fn(),
  getActiveTeamMemberCount: jest.fn(),
  getCurrentProjectsCount: jest.fn(),
  getFreePlanSettings: jest.fn(),
  getOwnerIdByTeam: jest.fn(),
  getTeamMemberCount: jest.fn(),
  getUsedStorage: jest.fn(),
  getCurrentSubscriptionRef: jest.fn(),
}));

jest.mock("../shared/s3", () => ({
  calculateStorage: jest.fn(),
}));

jest.mock("../shared/paddle-requests", () => ({
  addModifier: jest.fn(),
  cancelSubscription: jest.fn(),
  changePlan: jest.fn(),
  generatePayLinkRequest: jest.fn(),
  pauseOrResumeSubscription: jest.fn(),
}));

jest.mock("../shared/private-extensions", () => ({
  appSumoService: {
    getCountdownWidget: jest.fn(),
  },
}));

const mockQuery = db.query as jest.Mock;
const mockCheckTeamSubscriptionStatus = checkTeamSubscriptionStatus as jest.Mock;
const mockGetActiveTeamMemberCount = getActiveTeamMemberCount as jest.Mock;
const mockGetCurrentProjectsCount = getCurrentProjectsCount as jest.Mock;
const mockGetFreePlanSettings = getFreePlanSettings as jest.Mock;
const mockGetOwnerIdByTeam = getOwnerIdByTeam as jest.Mock;
const mockGetTeamMemberCount = getTeamMemberCount as jest.Mock;
const mockGetUsedStorage = getUsedStorage as jest.Mock;
const mockGetCurrentSubscriptionRef = getCurrentSubscriptionRef as jest.Mock;
const mockCalculateStorage = calculateStorage as jest.Mock;
const mockAddModifier = addModifier as jest.Mock;
const mockCancelSubscription = cancelSubscription as jest.Mock;
const mockChangePlan = changePlan as jest.Mock;
const mockGeneratePayLinkRequest = generatePayLinkRequest as jest.Mock;
const mockPauseOrResumeSubscription = pauseOrResumeSubscription as jest.Mock;
const mockGetCountdownWidget = appSumoService.getCountdownWidget as jest.Mock;

describe("AdminCenterBillingController", () => {
  const mockUser = {
    id: "user-1",
    owner_id: "owner-1",
    organization_id: "org-1",
    team_id: "team-1",
    name: "John Doe",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBillingInfo", () => {
    it("returns 200 false when billing information is not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ billing_info: null }] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getBillingInfo(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toBe("Billing information not found");
    });

    it("returns 200 with billing info including calculated dates and seat metrics", async () => {
      const billingInfo = {
        trial_expire_date: "2026-12-31",
        billing_type: "year",
        unit_price: 120,
        is_ltd_user: false,
      };

      mockQuery.mockResolvedValueOnce({ rows: [{ billing_info: billingInfo }] });
      mockGetActiveTeamMemberCount.mockResolvedValueOnce({ user_count: 5, free_count: 1 });
      mockCheckTeamSubscriptionStatus.mockResolvedValueOnce({
        quantity: 10,
        redeemed_codes_count: 0,
        appsumo_business_eligible: false,
        billing_provider: "paddle",
        subscription_ref: "sub-123",
      });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getBillingInfo(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.total_used).toBe(6);
      expect(res.body.body.total_seats).toBe(10);
      expect(res.body.body.unit_price_per_month).toBe(10);
      expect(res.body.body.expire_date_string).toBeDefined();
    });
  });

  describe("getBillingTransactions", () => {
    it("returns list of billing payment transactions", async () => {
      const transactions = [
        {
          subscription_payment_id: "tx-1",
          currency: "USD",
          status: "success",
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: transactions });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getBillingTransactions(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(transactions);
    });
  });

  describe("getBillingCharges", () => {
    it("returns plan charges and subscription modifiers", async () => {
      const charges = [{ unit_price: "10.00", quantity: 5, amount: "50.00" }];
      const modifiers = [{ subscription_id: 123 }];

      mockQuery
        .mockResolvedValueOnce({ rows: charges })
        .mockResolvedValueOnce({ rows: modifiers });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getBillingCharges(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual({
        plan_charges: charges,
        modifiers: modifiers,
      });
    });
  });

  describe("getBillingModifiers", () => {
    it("returns modifiers for user subscription", async () => {
      const modifiers = [{ created_at: "2026-01-01" }];
      mockQuery.mockResolvedValueOnce({ rows: modifiers });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getBillingModifiers(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(modifiers);
    });
  });

  describe("getBillingConfiguration and updateBillingConfiguration", () => {
    it("gets billing configuration", async () => {
      const configData = {
        name: "John Doe",
        email: "john@example.com",
        company_name: "Acme",
        phone: "1234567890",
        address_line_1: "123 Main St",
        city: "Colombo",
        country: "LK",
      };
      mockQuery.mockResolvedValueOnce({ rows: [configData] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getBillingConfiguration(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(configData);
    });

    it("updates billing configuration", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "org-1" }] });

      const req = createMockRequest({
        user: mockUser,
        body: {
          company_name: "Acme Corp",
          phone: "0771234567",
          address_line_1: "456 High St",
          address_line_2: "",
          city: "Kandy",
          state: "CP",
          postal_code: "20000",
          country: "LK",
        },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.updateBillingConfiguration(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.message).toBe("Configuration Updated");
    });
  });

  describe("upgradePlan", () => {
    it("generates payment link with user count or seatCount query parameter", async () => {
      mockGetTeamMemberCount.mockResolvedValueOnce({ user_count: 3 });
      mockGeneratePayLinkRequest.mockResolvedValueOnce({
        body: { url: "https://checkout.paddle.com/123" },
      });

      const req = createMockRequest({
        user: mockUser,
        query: { plan: "pro-annual", seatCount: "5" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.upgradePlan(req, res);

      expect(mockGeneratePayLinkRequest).toHaveBeenCalledWith(
        { user_count: 5 },
        "pro-annual",
        "owner-1",
        "user-1"
      );
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.url).toBe("https://checkout.paddle.com/123");
    });
  });

  describe("getPlans", () => {
    it("returns default plan limits when no settings found in database", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no data
      mockGetTeamMemberCount.mockResolvedValueOnce({ user_count: 2 });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getPlans(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.monthly_plan_name).toBe("Pro Monthly");
      expect(res.body.body.annual_plan_name).toBe("Pro Annual");
      expect(res.body.body.current_user_count).toBe(2);
    });

    it("formats plan limits and pricing when settings exist", async () => {
      const planSettings = {
        monthly_plan_id: "plan-m",
        monthly_plan_name: "Pro Monthly",
        annual_plan_id: "plan-a",
        annual_plan_name: "Pro Annual",
        monthly_price: "60",
        annual_price: 600,
        team_member_limit: 0,
        projects_limit: 0,
        free_tier_storage: 500,
      };

      mockQuery.mockResolvedValueOnce({ rows: [planSettings] });
      mockGetTeamMemberCount.mockResolvedValueOnce({ user_count: 5 });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getPlans(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.team_member_limit).toBe("Unlimited");
      expect(res.body.body.projects_limit).toBe("Unlimited");
      expect(res.body.body.free_tier_storage).toBe("500MB");
      expect(res.body.body.annual_price).toBe("50.00");
    });
  });

  describe("purchaseStorage and changePlan", () => {
    it("purchases storage modifier", async () => {
      mockGetCurrentSubscriptionRef.mockResolvedValueOnce("sub-456");
      mockAddModifier.mockResolvedValueOnce({});

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.purchaseStorage(req, res);

      expect(mockAddModifier).toHaveBeenCalledWith("sub-456");
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual({ subscription_id: "sub-456" });
    });

    it("changes subscription plan", async () => {
      mockGetCurrentSubscriptionRef.mockResolvedValueOnce("sub-456");
      mockChangePlan.mockResolvedValueOnce({ body: { success: true } });

      const req = createMockRequest({
        user: mockUser,
        query: { plan: "new-plan-id" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.changePlan(req, res);

      expect(mockChangePlan).toHaveBeenCalledWith("new-plan-id", "sub-456");
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
    });
  });

  describe("cancelPlan, pauseSubscription, resumeSubscription", () => {
    it("returns 200 false when owner_id is missing", async () => {
      const req = createMockRequest({ user: { id: "user-1" } }); // missing owner_id
      const res = createMockResponse();

      await AdminCenterBillingController.cancelPlan(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.body).toBe("Invalid Request.");
    });

    it("cancels subscription when owner_id is present", async () => {
      mockGetCurrentSubscriptionRef.mockResolvedValueOnce("sub-456");
      mockCancelSubscription.mockResolvedValueOnce({ body: { cancelled: true } });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.cancelPlan(req, res);

      expect(mockCancelSubscription).toHaveBeenCalledWith("sub-456", "owner-1");
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
    });

    it("pauses subscription", async () => {
      mockGetCurrentSubscriptionRef.mockResolvedValueOnce("sub-456");
      mockPauseOrResumeSubscription.mockResolvedValueOnce({ body: { paused: true } });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.pauseSubscription(req, res);

      expect(mockPauseOrResumeSubscription).toHaveBeenCalledWith("sub-456", "owner-1", true);
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
    });

    it("resumes subscription", async () => {
      mockGetCurrentSubscriptionRef.mockResolvedValueOnce("sub-456");
      mockPauseOrResumeSubscription.mockResolvedValueOnce({ body: { resumed: true } });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.resumeSubscription(req, res);

      expect(mockPauseOrResumeSubscription).toHaveBeenCalledWith("sub-456", "owner-1", false);
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
    });
  });

  describe("getBillingStorageInfo and getAccountStorage", () => {
    it("returns billing storage info", async () => {
      const storageInfo = {
        trial_in_progress: false,
        storage: 10,
        plan_name: "Pro",
      };
      mockQuery.mockResolvedValueOnce({ rows: [storageInfo] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getBillingStorageInfo(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(storageInfo);
    });

    it("calculates account storage across all teams", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "team-1" }, { id: "team-2" }] }) // teams
        .mockResolvedValueOnce({ rows: [{ storage: 10 }] }); // org total in GB

      mockCalculateStorage
        .mockResolvedValueOnce(1024 * 1024 * 100) // team 1: 100 MB
        .mockResolvedValueOnce(1024 * 1024 * 200); // team 2: 200 MB

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getAccountStorage(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.total).toBe(10);
      expect(res.body.body.used).toBe(1024 * 1024 * 300);
      expect(res.body.body.remaining).toBeGreaterThan(0);
    });
  });

  describe("getCountries", () => {
    it("returns list of countries", async () => {
      const countries = [
        { id: "1", name: "Sri Lanka", code: "LK" },
        { id: "2", name: "United States", code: "US" },
      ];
      mockQuery.mockResolvedValueOnce({ rows: countries });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getCountries(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(countries);
    });
  });

  describe("switchToFreePlan", () => {
    it("returns error if member limit is exceeded", async () => {
      mockGetFreePlanSettings.mockResolvedValueOnce({
        team_member_limit: "3",
        projects_limit: "5",
        free_tier_storage: "100",
      });
      mockGetOwnerIdByTeam.mockResolvedValueOnce("owner-1");
      mockGetTeamMemberCount.mockResolvedValueOnce("5"); // 5 > 3

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-1" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.switchToFreePlan(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toContain("cannot have more than 3 members");
    });

    it("returns error if project limit is exceeded", async () => {
      mockGetFreePlanSettings.mockResolvedValueOnce({
        team_member_limit: "0",
        projects_limit: "3",
        free_tier_storage: "100",
      });
      mockGetOwnerIdByTeam.mockResolvedValueOnce("owner-1");
      mockGetCurrentProjectsCount.mockResolvedValueOnce("5"); // 5 > 3

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-1" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.switchToFreePlan(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toContain("cannot have more than 3 projects");
    });

    it("returns error if storage limit is exceeded", async () => {
      mockGetFreePlanSettings.mockResolvedValueOnce({
        team_member_limit: "0",
        projects_limit: "10",
        free_tier_storage: "100",
      });
      mockGetOwnerIdByTeam.mockResolvedValueOnce("owner-1");
      mockGetCurrentProjectsCount.mockResolvedValueOnce("2");
      // 100MB is 104,857,600 bytes. 200MB in bytes:
      mockGetUsedStorage.mockResolvedValueOnce("209715200");

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-1" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.switchToFreePlan(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toContain("cannot exceed 100MB of storage");
    });

    it("successfully switches to free plan when within limits", async () => {
      mockGetFreePlanSettings.mockResolvedValueOnce({
        team_member_limit: "5",
        projects_limit: "5",
        free_tier_storage: "500",
      });
      mockGetOwnerIdByTeam.mockResolvedValueOnce("owner-1");
      mockGetTeamMemberCount.mockResolvedValueOnce("2");
      mockGetCurrentProjectsCount.mockResolvedValueOnce("2");
      mockGetUsedStorage.mockResolvedValueOnce("1000");
      mockQuery.mockResolvedValueOnce({ rows: [] }); // update query

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-1" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.switchToFreePlan(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.message).toContain("successfully switched to the Free Plan");
    });
  });

  describe("redeem", () => {
    it("returns error when coupon code verification fails", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // invalid or redeemed code

      const req = createMockRequest({
        user: mockUser,
        body: { code: "INVALID-CODE" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.redeem(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toContain("Redeem Code verification Failed");
    });

    it("returns error when max number of codes (limit > 50) is reached", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "coupon-1" }] }) // valid code
        .mockResolvedValueOnce({ rows: [{ team_member_total: "55" }] }); // total > 50

      const req = createMockRequest({
        user: mockUser,
        body: { code: "CODE-1" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.redeem(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toContain("Maximum number of codes redeemed!");
    });

    it("redeems code successfully and upgrades to Business Plan when count reaches 5", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "coupon-5" }] }) // code exists
        .mockResolvedValueOnce({ rows: [{ team_member_total: "30" }] }) // total members <= 50
        .mockResolvedValueOnce({ rows: [] }) // update licensing_coupon_codes
        .mockResolvedValueOnce({ rows: [] }) // update organizations
        .mockResolvedValueOnce({ rows: [{ redeemed_count: 5 }] }) // check count >= 5
        .mockResolvedValueOnce({ rows: [] }); // business plan update

      const req = createMockRequest({
        user: mockUser,
        body: { code: "FIFTH-CODE" },
      });
      const res = createMockResponse();

      await AdminCenterBillingController.redeem(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.message).toBe("Code redeemed successfully!");
      // Verify business plan upgrade was executed
      const businessPlanCall = mockQuery.mock.calls.find(([sql]) =>
        sql.includes("business_plan_override = TRUE")
      );
      expect(businessPlanCall).toBeDefined();
    });
  });

  describe("getFreePlanLimits", () => {
    it("returns free plan settings", async () => {
      const limits = { team_member_limit: "3", projects_limit: "3" };
      mockGetFreePlanSettings.mockResolvedValueOnce(limits);

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getFreePlanLimits(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(limits);
    });
  });

  describe("getAppSumoCountdownWidget", () => {
    it("returns 400 when organization_id is missing", async () => {
      const req = createMockRequest({ user: { id: "user-1" } });
      const res = createMockResponse();

      await AdminCenterBillingController.getAppSumoCountdownWidget(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toBe("Organization ID is required");
    });

    it("returns fallback countdown widget when user is not an AppSumo user", async () => {
      mockGetCountdownWidget.mockResolvedValueOnce(null);

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getAppSumoCountdownWidget(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.isVisible).toBe(false);
      expect(res.body.body.message).toContain("Not an AppSumo user");
    });

    it("returns active countdown widget when available", async () => {
      const widgetData = {
        isVisible: true,
        remainingDays: 2,
        remainingHours: 14,
        remainingMinutes: 30,
        urgencyLevel: "high",
        message: "2 days left to upgrade",
        ctaText: "Upgrade Now",
        ctaUrl: "/settings/billing",
      };
      mockGetCountdownWidget.mockResolvedValueOnce(widgetData);

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterBillingController.getAppSumoCountdownWidget(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(widgetData);
    });
  });
});
