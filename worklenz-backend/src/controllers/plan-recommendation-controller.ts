import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

import { PlanRecommendationService } from "../services/plan-recommendation-service";
import { UserAnalyticsService } from "../services/user-analytics-service";
import { AppSumoMigrationService } from "../services/appsumo-migration-service";
import { CustomPlanMappingService } from "../services/custom-plan-mapping-service";
import { MigrationCostBenefitService } from "../services/migration-cost-benefit-service";

import {
  PlanRecommendationResponse,
  PlanTier,
  UserType,
  MigrationCostBenefit,
} from "../interfaces/plan-recommendation";
import { DetailedMigrationCostBenefit } from "../services/migration-cost-benefit-service";

export default class PlanRecommendationController extends WorklenzControllerBase {
  /**
   * Get comprehensive plan recommendations for an organization
   */
  @HandleExceptions()
  public static async getRecommendations(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const recommendations =
        await PlanRecommendationService.generateRecommendations(organizationId);
      return res.status(200).send(new ServerResponse(true, recommendations));
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(false, null, "Failed to generate recommendations")
        );
    }
  }

  /**
   * Get detailed user analytics and usage patterns
   */
  @HandleExceptions()
  public static async getUserAnalytics(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const [usageMetrics, userProgression, insights] = await Promise.all([
        UserAnalyticsService.analyzeUsagePatterns(organizationId),
        UserAnalyticsService.analyzeUserTypeProgression(organizationId),
        UserAnalyticsService.generateUsageInsights(organizationId),
      ]);

      const analytics = {
        usageMetrics,
        userProgression,
        insights,
      };

      return res.status(200).send(new ServerResponse(true, analytics));
    } catch (error) {
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to analyze user data"));
    }
  }

  /**
   * Get AppSumo-specific migration options and countdown
   */
  @HandleExceptions()
  public static async getAppSumoOptions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const [appSumoStatus, appSumoRecommendations, countdownWidget] =
        await Promise.all([
          AppSumoMigrationService.checkAppSumoEligibility(organizationId),
          AppSumoMigrationService.getAppSumoRecommendations(
            organizationId
          ).catch(() => null),
          AppSumoMigrationService.getCountdownWidget(organizationId),
        ]);

      if (!appSumoStatus || !appSumoStatus.isAppSumoUser) {
        return res
          .status(200)
          .send(new ServerResponse(true, { isAppSumoUser: false }));
      }

      const appSumoData = {
        status: appSumoStatus,
        recommendations: appSumoRecommendations,
        countdownWidget,
      };

      return res.status(200).send(new ServerResponse(true, appSumoData));
    } catch (error) {
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to get AppSumo options"));
    }
  }

  /**
   * Get custom plan mappings and grandfathered options
   */
  @HandleExceptions()
  public static async getCustomPlanOptions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const customPlanMappings =
        await CustomPlanMappingService.getCustomPlanMappings(organizationId);

      if (!customPlanMappings) {
        return res
          .status(200)
          .send(new ServerResponse(true, { isCustomPlanUser: false }));
      }

      return res.status(200).send(
        new ServerResponse(true, {
          isCustomPlanUser: true,
          mappings: customPlanMappings,
        })
      );
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(false, null, "Failed to get custom plan options")
        );
    }
  }

  /**
   * Perform comprehensive cost-benefit analysis for a specific plan
   */
  @HandleExceptions()
  public static async getCostBenefitAnalysis(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;
    const { targetPlan } = req.query;

    if (!organizationId || !targetPlan) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Organization ID and target plan are required"
          )
        );
    }

    try {
      // Get comprehensive user analytics first
      const userAnalytics =
        await PlanRecommendationService.generateRecommendations(organizationId);

      // Perform cost-benefit analysis
      const costBenefitAnalysis =
        await MigrationCostBenefitService.performCostBenefitAnalysis(
          organizationId,
          targetPlan as PlanTier,
          userAnalytics.userAnalytics.userType,
          userAnalytics.userAnalytics.usageMetrics,
          userAnalytics.userAnalytics.customPlanDetails,
          userAnalytics.userAnalytics.appSumoStatus,
          userAnalytics.userAnalytics.migrationEligibility.discounts
        );

      return res
        .status(200)
        .send(new ServerResponse(true, costBenefitAnalysis));
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(
            false,
            null,
            "Failed to perform cost-benefit analysis"
          )
        );
    }
  }

  /**
   * Process AppSumo migration
   */
  @HandleExceptions()
  public static async processAppSumoMigration(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;
    const { selectedPlan, userConsent } = req.body;

    if (!organizationId || !selectedPlan || userConsent !== true) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Organization ID, selected plan, and user consent are required"
          )
        );
    }

    try {
      const migrationResult =
        await AppSumoMigrationService.processAppSumoMigration(
          organizationId,
          selectedPlan as PlanTier,
          userConsent
        );

      if (migrationResult.success) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              true,
              migrationResult,
              "Migration completed successfully"
            )
          );
      }
      return res
        .status(400)
        .send(new ServerResponse(false, null, migrationResult.message));
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(false, null, "Failed to process AppSumo migration")
        );
    }
  }

  /**
   * Create custom plan mapping
   */
  @HandleExceptions()
  public static async createCustomMapping(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;
    const { recommendedPlan, preservePricing } = req.body;

    if (!organizationId || !recommendedPlan) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Organization ID and recommended plan are required"
          )
        );
    }

    try {
      const mappingResult =
        await CustomPlanMappingService.createCustomPlanMapping(
          organizationId,
          recommendedPlan as PlanTier,
          preservePricing !== false // Default to true
        );

      if (mappingResult.success) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              true,
              mappingResult,
              "Custom plan mapping created successfully"
            )
          );
      }
      return res
        .status(400)
        .send(new ServerResponse(false, null, mappingResult.message));
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(
            false,
            null,
            "Failed to create custom plan mapping"
          )
        );
    }
  }

  /**
   * Generate grandfathered pricing discount
   */
  @HandleExceptions()
  public static async generateGrandfatheredDiscount(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;
    const { targetPlan } = req.body;

    if (!organizationId || !targetPlan) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Organization ID and target plan are required"
          )
        );
    }

    try {
      const discount =
        await CustomPlanMappingService.generateGrandfatheredDiscount(
          organizationId,
          targetPlan as PlanTier
        );

      if (discount) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              true,
              discount,
              "Grandfathered discount generated"
            )
          );
      }
      return res
        .status(200)
        .send(
          new ServerResponse(true, null, "No grandfathered discount needed")
        );
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(
            false,
            null,
            "Failed to generate grandfathered discount"
          )
        );
    }
  }

  /**
   * Get plan comparison matrix
   */
  @HandleExceptions()
  public static async getPlanComparison(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;
    const { comparePlans } = req.query;

    if (!organizationId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      // Get user analytics for context
      const userAnalytics =
        await PlanRecommendationService.generateRecommendations(organizationId);

      // Parse plans to compare (default to all if not specified)
      const plansToCompare = comparePlans
        ? ((comparePlans as string).split(",") as PlanTier[])
        : [
            PlanTier.PRO_SMALL,
            PlanTier.BUSINESS_SMALL,
            PlanTier.PRO_LARGE,
            PlanTier.BUSINESS_LARGE,
            PlanTier.ENTERPRISE,
          ];

      // Generate comparison data
      const comparisons = [];
      for (const plan of plansToCompare) {
        try {
          const costBenefit =
            await MigrationCostBenefitService.performCostBenefitAnalysis(
              organizationId,
              plan,
              userAnalytics.userAnalytics.userType,
              userAnalytics.userAnalytics.usageMetrics,
              userAnalytics.userAnalytics.customPlanDetails,
              userAnalytics.userAnalytics.appSumoStatus,
              userAnalytics.userAnalytics.migrationEligibility.discounts
            );

          comparisons.push({
            plan,
            costAnalysis: costBenefit.costAnalysis,
            benefitAnalysis: costBenefit.benefitAnalysis,
            riskAssessment: costBenefit.riskAssessment,
            recommendationScore: this.calculateComparisonScore(costBenefit),
          });
        } catch (error) {
          // Skip this plan if analysis fails
          continue;
        }
      }

      // Sort by recommendation score
      comparisons.sort((a, b) => b.recommendationScore - a.recommendationScore);

      const comparisonMatrix = {
        userContext: {
          userType: userAnalytics.userAnalytics.userType,
          currentUsers: userAnalytics.userAnalytics.usageMetrics.totalUsers,
          growthTrend: userAnalytics.userAnalytics.usageMetrics.growthTrend,
        },
        comparisons,
        recommendations: userAnalytics.recommendations.slice(0, 3), // Top 3 recommendations
      };

      return res.status(200).send(new ServerResponse(true, comparisonMatrix));
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(false, null, "Failed to generate plan comparison")
        );
    }
  }

  /**
   * Calculate comparison score for sorting
   */
  private static calculateComparisonScore(
    costBenefit: DetailedMigrationCostBenefit
  ): number {
    const costScore = costBenefit.costAnalysis.paybackPeriod
      ? Math.max(0, 100 - costBenefit.costAnalysis.paybackPeriod * 5)
      : 50;
    const benefitScore = Math.min(
      100,
      costBenefit.benefitAnalysis.quantifiedValue / 1000
    );
    const riskScore = 100 - costBenefit.riskAssessment.overallRiskScore;

    return Math.round(costScore * 0.4 + benefitScore * 0.4 + riskScore * 0.2);
  }

  /**
   * Get migration preview for a specific plan
   */
  @HandleExceptions()
  public static async getMigrationPreview(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { organizationId } = req.params;
    const { targetPlan } = req.query;

    if (!organizationId || !targetPlan) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Organization ID and target plan are required"
          )
        );
    }

    try {
      const [userAnalytics, costBenefit] = await Promise.all([
        PlanRecommendationService.generateRecommendations(organizationId),
        MigrationCostBenefitService.performCostBenefitAnalysis(
          organizationId,
          targetPlan as PlanTier,
          UserType.TRIAL, // Will be determined from userAnalytics
          {} as any, // Will be populated from userAnalytics
          undefined,
          undefined,
          []
        ).catch(() => null),
      ]);

      const preview = {
        currentPlan: {
          type: userAnalytics.userAnalytics.userType,
          features:
            userAnalytics.userAnalytics.customPlanDetails?.currentFeatures ||
            {},
          cost:
            userAnalytics.userAnalytics.customPlanDetails?.currentPricing || 0,
        },
        targetPlan: {
          tier: targetPlan,
          cost: costBenefit?.costAnalysis.newMonthlyCost || 0,
          features: this.getPlanFeatures(targetPlan as PlanTier),
        },
        migration: {
          timeline: costBenefit?.timeline || null,
          costs: costBenefit?.costAnalysis.migrationCosts || 0,
          risks: costBenefit?.riskAssessment.overallRiskScore || 0,
          benefits: costBenefit?.benefitAnalysis.quantifiedValue || 0,
        },
        whatChanges: this.generateWhatChanges(
          userAnalytics,
          targetPlan as PlanTier
        ),
        whatStaysTheSame: this.generateWhatStaysTheSame(),
      };

      return res.status(200).send(new ServerResponse(true, preview));
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(
            false,
            null,
            "Failed to generate migration preview"
          )
        );
    }
  }

  /**
   * Get plan features for display
   */
  private static getPlanFeatures(planTier: PlanTier): any {
    const features = {
      [PlanTier.FREE]: ["3 users", "5GB storage", "Basic projects"],
      [PlanTier.PRO_SMALL]: [
        "5 users",
        "100GB storage",
        "Gantt charts",
        "Time tracking",
        "Custom fields",
      ],
      [PlanTier.BUSINESS_SMALL]: [
        "5 users",
        "500GB storage",
        "All Pro features",
        "Advanced reporting",
        "Client portal",
      ],
      [PlanTier.PRO_LARGE]: [
        "50 users",
        "1TB storage",
        "All Pro Small features",
        "Extended user capacity",
      ],
      [PlanTier.BUSINESS_LARGE]: [
        "100 users",
        "2TB storage",
        "All Business features",
        "Resource management",
      ],
      [PlanTier.ENTERPRISE]: [
        "Unlimited users",
        "Unlimited storage",
        "All features",
        "SSO",
        "Dedicated support",
      ],
    };

    return features[planTier] || [];
  }

  /**
   * Generate what changes in migration
   */
  private static generateWhatChanges(
    userAnalytics: PlanRecommendationResponse,
    targetPlan: PlanTier
  ): string[] {
    const changes = [];

    if (userAnalytics.userAnalytics.userType === UserType.FREE) {
      changes.push("Upgrade from Free plan limitations");
      changes.push("Access to premium features");
    }

    if (userAnalytics.userAnalytics.userType === UserType.CUSTOM_PLAN) {
      changes.push("Migration to standardized pricing");
      changes.push("Updated feature set");
    }

    if (userAnalytics.userAnalytics.userType === UserType.APPSUMO) {
      changes.push("Transition from AppSumo legacy plan");
      changes.push("New billing cycle begins");
    }

    changes.push("Enhanced support level");
    changes.push("Access to latest product updates");

    return changes;
  }

  /**
   * Generate what stays the same
   */
  private static generateWhatStaysTheSame(): string[] {
    return [
      "All your project data",
      "Team member access",
      "Existing integrations",
      "Custom configurations",
      "File attachments",
      "Activity history",
      "User permissions (unless enhanced)",
      "API access and webhooks",
    ];
  }

  /**
   * Send AppSumo migration notifications (Admin only)
   */
  @HandleExceptions()
  public static async sendAppSumoNotifications(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // Check if user is admin
    if (!req.user?.is_admin) {
      return res
        .status(403)
        .send(new ServerResponse(false, null, "Admin access required"));
    }

    try {
      const result = await AppSumoMigrationService.sendMigrationNotifications();

      return res
        .status(200)
        .send(
          new ServerResponse(
            true,
            result,
            `Sent ${result.notificationsSent} notifications${
              result.errors.length > 0
                ? ` with ${result.errors.length} errors`
                : ""
            }`
          )
        );
    } catch (error) {
      return res
        .status(500)
        .send(
          new ServerResponse(
            false,
            null,
            "Failed to send AppSumo notifications"
          )
        );
    }
  }

  /**
   * Get admin analytics (Admin only)
   */
  @HandleExceptions()
  public static async getAdminAnalytics(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // Check if user is admin
    if (!req.user?.is_admin) {
      return res
        .status(403)
        .send(new ServerResponse(false, null, "Admin access required"));
    }

    try {
      const [appSumoAnalytics, customPlanAnalytics] = await Promise.all([
        AppSumoMigrationService.getAppSumoAnalytics(),
        CustomPlanMappingService.getCustomPlanAnalytics(),
      ]);

      const analytics = {
        appSumo: appSumoAnalytics,
        customPlans: customPlanAnalytics,
        summary: {
          totalMigrationOpportunities:
            appSumoAnalytics.eligibleForMigration +
            customPlanAnalytics.mappedPlans,
          urgentActions: appSumoAnalytics.urgentUsers,
          potentialRevenue:
            appSumoAnalytics.revenueImpact.potentialRevenue +
            customPlanAnalytics.potentialRevenue,
          conversionRate: appSumoAnalytics.conversionRate,
        },
      };

      return res.status(200).send(new ServerResponse(true, analytics));
    } catch (error) {
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to get admin analytics"));
    }
  }
}
