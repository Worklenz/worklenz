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
  PlanTier,
  UserType,
  MigrationCostBenefit
} from "../interfaces/plan-recommendation";
import { DetailedMigrationCostBenefit } from "../services/migration-cost-benefit-service";

export default class MigrationController extends WorklenzControllerBase {

  /**
   * Check user's migration eligibility and available options
   * GET /api/migration/eligibility
   */
  @HandleExceptions()
  public static async checkEligibility(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const [recommendations, userProgression] = await Promise.all([
        PlanRecommendationService.generateRecommendations(organizationId),
        UserAnalyticsService.analyzeUserTypeProgression(organizationId)
      ]);

      const eligibility = {
        isEligible: recommendations.userAnalytics.migrationEligibility.isEligible,
        userType: recommendations.userAnalytics.userType,
        currentPlan: {
          type: recommendations.userAnalytics.userType,
          features: recommendations.userAnalytics.customPlanDetails?.currentFeatures || null,
          pricing: recommendations.userAnalytics.customPlanDetails?.currentPricing || 0
        },
        eligiblePlans: recommendations.userAnalytics.migrationEligibility.eligiblePlans,
        availableDiscounts: recommendations.userAnalytics.migrationEligibility.discounts,
        migrationWindow: recommendations.userAnalytics.migrationEligibility.migrationWindow,
        urgentActions: recommendations.urgentActions,
        progressionLikelihood: userProgression.progressionLikelihood,
        specialOffers: recommendations.specialOffers,
        preservedBenefits: recommendations.userAnalytics.migrationEligibility.preservedBenefits
      };

      return res.status(200).send(new ServerResponse(true, eligibility));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to check migration eligibility"));
    }
  }

  /**
   * Get personalized plan recommendations
   * GET /api/migration/recommendations
   */
  @HandleExceptions()
  public static async getRecommendations(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const { includeAnalytics, includeComparison } = req.query;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const recommendations = await PlanRecommendationService.generateRecommendations(organizationId);
      
      // Filter and enhance recommendations based on query parameters
      let response = {
        recommendations: recommendations.recommendations.slice(0, 5), // Top 5 recommendations
        migrationSummary: recommendations.migrationSummary,
        specialOffers: recommendations.specialOffers
      };

      if (includeAnalytics === "true") {
        const analytics = await UserAnalyticsService.generateUsageInsights(organizationId);
        response = { ...response, ...{ analytics } };
      }

      if (includeComparison === "true") {
        const comparison = await this.generatePlanComparison(organizationId, recommendations.recommendations);
        response = { ...response, ...{ comparison } };
      }

      return res.status(200).send(new ServerResponse(true, response));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to generate recommendations"));
    }
  }

  /**
   * Preview migration costs and changes
   * POST /api/migration/preview
   */
  @HandleExceptions()
  public static async previewMigration(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const { targetPlan, billingCycle, applyDiscounts } = req.body;
    
    if (!organizationId || !targetPlan) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID and target plan are required"));
    }

    try {
      // Get comprehensive user analytics
      const userAnalytics = await PlanRecommendationService.generateRecommendations(organizationId);
      
      // Perform detailed cost-benefit analysis
      const costBenefitAnalysis = await MigrationCostBenefitService.performCostBenefitAnalysis(
        organizationId,
        targetPlan as PlanTier,
        userAnalytics.userAnalytics.userType,
        userAnalytics.userAnalytics.usageMetrics,
        userAnalytics.userAnalytics.customPlanDetails,
        userAnalytics.userAnalytics.appSumoStatus,
        applyDiscounts ? userAnalytics.userAnalytics.migrationEligibility.discounts : []
      );

      // Convert detailed analysis to simplified format
      const simplifiedCostAnalysis = {
        monthlyDifference: costBenefitAnalysis.costAnalysis.newMonthlyCost - costBenefitAnalysis.costAnalysis.currentMonthlyCost,
        annualDifference: (costBenefitAnalysis.costAnalysis.newMonthlyCost - costBenefitAnalysis.costAnalysis.currentMonthlyCost) * 12,
        percentageChange: costBenefitAnalysis.costAnalysis.currentMonthlyCost > 0 
          ? ((costBenefitAnalysis.costAnalysis.newMonthlyCost - costBenefitAnalysis.costAnalysis.currentMonthlyCost) / costBenefitAnalysis.costAnalysis.currentMonthlyCost) * 100
          : 0,
        paybackPeriod: costBenefitAnalysis.costAnalysis.paybackPeriod,
        totalCostOfOwnership: {
          year1: costBenefitAnalysis.costAnalysis.firstYearCost,
          year2: costBenefitAnalysis.costAnalysis.newMonthlyCost * 24,
          year3: costBenefitAnalysis.costAnalysis.newMonthlyCost * 36
        }
      };

      const simplifiedBenefitAnalysis = {
        newFeatures: costBenefitAnalysis.benefitAnalysis.featureUpgrades.map(f => f.feature),
        enhancedFeatures: costBenefitAnalysis.benefitAnalysis.featureUpgrades.filter(f => f.newState === "advanced").map(f => f.feature),
        retainedFeatures: costBenefitAnalysis.benefitAnalysis.featureUpgrades.filter(f => f.currentState !== "unavailable").map(f => f.feature),
        removedFeatures: [],
        productivityGains: costBenefitAnalysis.benefitAnalysis.quantifiedValue,
        riskReduction: costBenefitAnalysis.riskAssessment.overallRiskScore
      };

      const preview = {
        targetPlan: {
          tier: targetPlan,
          name: this.getPlanDisplayName(targetPlan as PlanTier),
          billingCycle: billingCycle || "monthly",
          features: this.getPlanFeatures(targetPlan as PlanTier)
        },
        costAnalysis: simplifiedCostAnalysis,
        benefitAnalysis: simplifiedBenefitAnalysis,
        migrationTimeline: costBenefitAnalysis.timeline,
        riskAssessment: costBenefitAnalysis.riskAssessment,
        whatChanges: this.generateMigrationChanges(userAnalytics, targetPlan as PlanTier),
        whatStaysTheSame: this.getPreservedElements(),
        recommendations: costBenefitAnalysis.recommendations,
        canProceed: this.assessMigrationViability(costBenefitAnalysis),
        requiredActions: this.getRequiredActions(userAnalytics, costBenefitAnalysis)
      };

      return res.status(200).send(new ServerResponse(true, preview));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to generate migration preview"));
    }
  }

  /**
   * Execute migration to new plan
   * POST /api/migration/execute
   */
  @HandleExceptions()
  public static async executeMigration(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const { 
      targetPlan, 
      billingCycle, 
      userConsent, 
      preserveGrandfathering,
      applyDiscounts,
      migrationOptions 
    } = req.body;
    
    if (!organizationId || !targetPlan || !userConsent) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID, target plan, and user consent are required"));
    }

    try {
      // Validate migration eligibility
      const eligibility = await PlanRecommendationService.generateRecommendations(organizationId);
      
      if (!eligibility.userAnalytics.migrationEligibility.isEligible) {
        return res.status(400).send(new ServerResponse(false, null, "User is not eligible for migration"));
      }

      // Check if it's an AppSumo migration
      if (eligibility.userAnalytics.userType === UserType.APPSUMO) {
        const appSumoResult = await AppSumoMigrationService.processAppSumoMigration(
          organizationId,
          targetPlan as PlanTier,
          userConsent
        );
        
        if (!appSumoResult.success) {
          return res.status(400).send(new ServerResponse(false, null, appSumoResult.message));
        }

        return res.status(200).send(new ServerResponse(true, {
          migrationId: appSumoResult.migrationId,
          migrationContext: appSumoResult.migrationContext,
          discountApplied: appSumoResult.discountApplied,
          message: appSumoResult.message,
          nextSteps: this.getPostMigrationSteps(targetPlan as PlanTier, "appsumo")
        }, "AppSumo migration completed successfully"));
      }

      // Handle custom plan migration
      if (eligibility.userAnalytics.userType === UserType.CUSTOM_PLAN && preserveGrandfathering) {
        const mappingResult = await CustomPlanMappingService.createCustomPlanMapping(
          organizationId,
          targetPlan as PlanTier,
          preserveGrandfathering
        );

        if (!mappingResult.success) {
          return res.status(400).send(new ServerResponse(false, null, mappingResult.message));
        }

        // Generate grandfathered discount if applicable
        const grandfatheredDiscount = await CustomPlanMappingService.generateGrandfatheredDiscount(
          organizationId,
          targetPlan as PlanTier
        );

        return res.status(200).send(new ServerResponse(true, {
          migrationId: mappingResult.mappingId,
          migrationContext: "custom_plan_grandfathered",
          grandfatheredDiscount,
          message: "Custom plan migration completed with preserved pricing",
          nextSteps: this.getPostMigrationSteps(targetPlan as PlanTier, "custom_grandfathered")
        }, "Custom plan migration completed successfully"));
      }

      // Standard migration flow
      const migrationResult = await this.processStandardMigration(
        organizationId,
        targetPlan as PlanTier,
        billingCycle,
        eligibility.userAnalytics.migrationEligibility.discounts,
        migrationOptions
      );

      if (!migrationResult.success) {
        return res.status(400).send(new ServerResponse(false, null, migrationResult.message));
      }

      return res.status(200).send(new ServerResponse(true, {
        migrationId: migrationResult.migrationId,
        migrationContext: "standard_migration",
        message: migrationResult.message,
        nextSteps: this.getPostMigrationSteps(targetPlan as PlanTier, "standard")
      }, "Migration completed successfully"));

    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to execute migration"));
    }
  }

  /**
   * Check AppSumo discount eligibility
   * GET /api/migration/appsumo-discount
   */
  @HandleExceptions()
  public static async checkAppSumoDiscount(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const [appSumoStatus, recommendations, countdown] = await Promise.all([
        AppSumoMigrationService.checkAppSumoEligibility(organizationId),
        AppSumoMigrationService.getAppSumoRecommendations(organizationId).catch(() => null),
        AppSumoMigrationService.getCountdownWidget(organizationId)
      ]);

      if (!appSumoStatus || !appSumoStatus.isAppSumoUser) {
        return res.status(200).send(new ServerResponse(true, {
          isAppSumoUser: false,
          eligibleForDiscount: false,
          message: "User is not an AppSumo customer"
        }));
      }

      const discountInfo = {
        isAppSumoUser: true,
        eligibleForDiscount: appSumoStatus.eligibleForSpecialDiscount,
        discountRate: appSumoStatus.specialOfferDiscount,
        remainingDays: appSumoStatus.remainingMigrationDays,
        minimumPlanTier: appSumoStatus.minimumPlanTier,
        alreadyMigrated: appSumoStatus.alreadyMigrated,
        recommendations,
        countdown,
        postDiscountOptions: recommendations?.postDiscountOptions || null
      };

      return res.status(200).send(new ServerResponse(true, discountInfo));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to check AppSumo discount eligibility"));
    }
  }

  /**
   * Helper methods
   */
  private static async generatePlanComparison(organizationId: string, recommendations: any[]): Promise<any> {
    const topPlans = recommendations.slice(0, 3).map(r => r.planTier);
    const comparisons = [];

    for (const plan of topPlans) {
      try {
        const costBenefit = await MigrationCostBenefitService.performCostBenefitAnalysis(
          organizationId,
          plan,
          UserType.TRIAL, // Will be determined from user analytics
          {} as any,
          undefined,
          undefined,
          []
        );

        comparisons.push({
          plan,
          features: this.getPlanFeatures(plan),
          pricing: costBenefit.costAnalysis.newMonthlyCost,
          benefits: costBenefit.benefitAnalysis.quantifiedValue,
          risks: costBenefit.riskAssessment.overallRiskScore
        });
      } catch (error) {
        continue;
      }
    }

    return comparisons;
  }

  private static async processStandardMigration(
    organizationId: string,
    targetPlan: PlanTier,
    billingCycle: string,
    availableDiscounts: any[],
    migrationOptions: any
  ): Promise<{ success: boolean; message: string; migrationId?: string }> {
    // This would integrate with Paddle to create the subscription
    // For now, we'll simulate the process
    
    try {
      // Record migration in audit trail
      const migrationId = `migration_${Date.now()}_${organizationId}`;
      
      // Here you would:
      // 1. Create Paddle subscription
      // 2. Apply any discounts
      // 3. Update user's subscription status
      // 4. Send confirmation emails
      // 5. Update analytics

      return {
        success: true,
        message: `Successfully migrated to ${targetPlan} plan`,
        migrationId
      };
    } catch (error) {
      return {
        success: false,
        message: "Migration processing failed"
      };
    }
  }

  private static getPlanDisplayName(planTier: PlanTier): string {
    const names = {
      [PlanTier.FREE]: "Free Plan",
      [PlanTier.PRO_SMALL]: "Pro Small",
      [PlanTier.BUSINESS_SMALL]: "Business Small",
      [PlanTier.PRO_LARGE]: "Pro Large",
      [PlanTier.BUSINESS_LARGE]: "Business Large",
      [PlanTier.ENTERPRISE]: "Enterprise"
    };
    return names[planTier] || planTier;
  }

  private static getPlanFeatures(planTier: PlanTier): string[] {
    const features = {
      [PlanTier.FREE]: ["3 users", "5GB storage", "Basic projects"],
      [PlanTier.PRO_SMALL]: ["5 users", "100GB storage", "Gantt charts", "Time tracking", "Custom fields"],
      [PlanTier.BUSINESS_SMALL]: ["5 users", "500GB storage", "All Pro features", "Advanced reporting", "Client portal"],
      [PlanTier.PRO_LARGE]: ["50 users", "1TB storage", "All Pro Small features", "Extended capacity"],
      [PlanTier.BUSINESS_LARGE]: ["100 users", "2TB storage", "All Business features", "Resource management"],
      [PlanTier.ENTERPRISE]: ["Unlimited users", "Unlimited storage", "All features", "SSO", "Dedicated support"]
    };
    return features[planTier] || [];
  }

  private static generateMigrationChanges(userAnalytics: any, targetPlan: PlanTier): string[] {
    const changes = [];
    
    if (userAnalytics.userAnalytics.userType === UserType.FREE) {
      changes.push("Upgrade from Free plan limitations");
      changes.push("Access to premium features");
    }
    
    if (userAnalytics.userAnalytics.userType === UserType.TRIAL) {
      changes.push("Convert from trial to paid subscription");
      changes.push("Continued access to all features");
    }
    
    if (userAnalytics.userAnalytics.userType === UserType.CUSTOM_PLAN) {
      changes.push("Migration to standardized pricing");
      changes.push("Updated feature set and support levels");
    }
    
    changes.push("Enhanced customer support");
    changes.push("Access to latest product updates");
    changes.push("Improved billing and account management");
    
    return changes;
  }

  private static getPreservedElements(): string[] {
    return [
      "All project data and history",
      "Team member access and permissions",
      "Custom configurations and settings",
      "File attachments and documents",
      "Activity logs and audit trails",
      "Integration connections",
      "Custom fields and templates",
      "Workflow automations"
    ];
  }

  private static assessMigrationViability(costBenefit: DetailedMigrationCostBenefit): boolean {
    // Migration is viable if benefits outweigh costs and risks are manageable
    const netBenefit = costBenefit.benefitAnalysis.quantifiedValue - costBenefit.costAnalysis.firstYearCost;
    const riskThreshold = 70;
    
    return netBenefit > 0 && costBenefit.riskAssessment.overallRiskScore < riskThreshold;
  }

  private static getRequiredActions(userAnalytics: any, costBenefit: DetailedMigrationCostBenefit): string[] {
    const actions = [];
    
    // Check for high-risk migrations
    if (costBenefit.riskAssessment.overallRiskScore > 60) {
      actions.push("Review risk mitigation strategies");
      actions.push("Consider phased migration approach");
    }
    
    // AppSumo specific actions
    if (userAnalytics.userAnalytics.userType === UserType.APPSUMO) {
      if (userAnalytics.userAnalytics.appSumoStatus?.remainingMigrationDays <= 2) {
        actions.push("Urgent: Complete migration within discount window");
      }
    }
    
    // Custom plan specific actions
    if (userAnalytics.userAnalytics.userType === UserType.CUSTOM_PLAN) {
      actions.push("Review grandfathered benefit preservation options");
      actions.push("Confirm feature mapping compatibility");
    }
    
    return actions;
  }

  private static getPostMigrationSteps(targetPlan: PlanTier, migrationContext: string): string[] {
    const steps = [
      "Verify new plan features are activated",
      "Update team members on new capabilities",
      "Review billing and payment settings",
      "Access new customer support channels"
    ];

    if (migrationContext === "appsumo") {
      steps.push("Confirm AppSumo discount application");
      steps.push("Set calendar reminder for discount renewal period");
    }

    if (migrationContext === "custom_grandfathered") {
      steps.push("Verify grandfathered pricing preservation");
      steps.push("Review preserved benefits documentation");
    }

    if ([PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE].includes(targetPlan)) {
      steps.push("Explore advanced reporting features");
      steps.push("Set up client portal if applicable");
    }

    return steps;
  }
}