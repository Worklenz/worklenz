import { log_error } from "./utils";
import {
  AppSumoStatus,
} from "../interfaces/plan-recommendation";

/**
 * Extension point for functionality that must never ship in the published (public) tree —
 * currently the AppSumo lifetime-deal campaign and (separately) DirectPay. The real
 * implementations live in src/private/, which is excluded when the public tree is built.
 * Everything here degrades to a safe no-op when src/private/ isn't present, so ee/ and core
 * code can depend on these interfaces unconditionally.
 */

export interface IAppSumoService {
  isAppSumoUser(subscriptionType?: string, planName?: string): boolean;
  getAppSumoPaddlePlanId(planTier: string, billingCycle: "monthly" | "annual"): number | null;
  checkCampaignEligibility(organizationId: string): Promise<{
    eligible: boolean;
    campaignId?: string;
    discountAmount?: number;
    finalPrice?: number;
    expiresAt?: Date;
    message?: string;
    remainingDays?: number;
    remainingHours?: number;
    remainingMinutes?: number;
  }>;
  getCountdownWidget(organizationId: string): Promise<{
    isVisible: boolean;
    remainingDays: number;
    remainingHours: number;
    remainingMinutes: number;
    urgencyLevel: string;
    message: string;
    ctaText: string;
    ctaUrl: string;
  } | null>;
  getBusinessPlanUserLimit(subscriptionType?: string, planName?: string, defaultLimit?: number): number;
  applyAppSumoDiscount(organizationId: string, originalPrice: number, planTier: string): Promise<{
    discountApplied: boolean;
    discountAmount: number;
    finalPrice: number;
    paddlePlanId?: number;
    specialUserLimit?: number;
  }>;
}

export interface IAppSumoLtdEntitlement {
  is_ltd: boolean;
  redeemed_codes_count: number;
  appsumo_business_eligible: boolean;
}

export interface IAppSumoLtdEntitlementService {
  getEntitlementForUser(userId: string): Promise<IAppSumoLtdEntitlement>;
  getBusinessUnlockCodeCount(): number;
}

export interface IAppSumoMigrationService {
  checkAppSumoEligibility(organizationId: string): Promise<AppSumoStatus | null>;
  getAppSumoRecommendations(organizationId: string): Promise<any>;
  getCountdownWidget(organizationId: string): Promise<any>;
  processAppSumoMigration(organizationId: string, targetPlanTier: string, billingCycle: "monthly" | "annual"): Promise<any>;
  sendMigrationNotifications(): Promise<any>;
  getAppSumoAnalytics(): Promise<any>;
}

const noopAppSumoService: IAppSumoService = {
  isAppSumoUser: () => false,
  getAppSumoPaddlePlanId: () => null,
  checkCampaignEligibility: async () => ({ eligible: false, message: "Not available" }),
  getCountdownWidget: async () => null,
  getBusinessPlanUserLimit: (_subscriptionType, _planName, defaultLimit = 25) => defaultLimit,
  applyAppSumoDiscount: async (_organizationId, originalPrice) => ({
    discountApplied: false,
    discountAmount: 0,
    finalPrice: originalPrice,
  }),
};

const noopAppSumoLtdEntitlementService: IAppSumoLtdEntitlementService = {
  getEntitlementForUser: async () => ({
    is_ltd: false,
    redeemed_codes_count: 0,
    appsumo_business_eligible: false,
  }),
  getBusinessUnlockCodeCount: () => 5,
};

const noopAppSumoMigrationService: IAppSumoMigrationService = {
  checkAppSumoEligibility: async () => null,
  getAppSumoRecommendations: async () => null,
  getCountdownWidget: async () => null,
  processAppSumoMigration: async () => ({ success: false, error: "Not available" }),
  sendMigrationNotifications: async () => ({
    success: true,
    notificationsSent: 0,
    notifications: [],
    errors: [],
  }),
  getAppSumoAnalytics: async () => ({
    totalAppSumoUsers: 0,
    migratedUsers: 0,
    pendingMigrations: 0,
    averageDiscountApplied: 0,
    annualPlanMigrations: 0,
    monthlyPlanMigrations: 0,
    migrationRate: 0,
    eligibleForMigration: 0,
    urgentUsers: 0,
    revenueImpact: { potentialRevenue: 0, actualRevenue: 0, lostRevenue: 0 },
    conversionRate: 0,
  }),
};

function load<T>(modulePath: string, exportName: string, fallback: T): T {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(modulePath);
    return (mod[exportName] as T) ?? fallback;
  } catch (error) {
    log_error(`private-extensions: ${modulePath} not present, using no-op (${(error as Error).message})`);
    return fallback;
  }
}

export const appSumoService: IAppSumoService =
  load("../private/services/appsumo-service", "AppSumoService", noopAppSumoService);

export const appSumoLtdEntitlementService: IAppSumoLtdEntitlementService =
  load("../private/services/appsumo-ltd-entitlement-service", "AppSumoLtdEntitlementService", noopAppSumoLtdEntitlementService);

export const appSumoMigrationService: IAppSumoMigrationService =
  load("../private/services/appsumo-migration-service", "AppSumoMigrationService", noopAppSumoMigrationService);
