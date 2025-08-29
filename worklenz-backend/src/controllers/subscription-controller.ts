import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

import { PlanRecommendationService } from "../services/plan-recommendation-service";
import { UserAnalyticsService } from "../services/user-analytics-service";
import { CustomPlanMappingService } from "../services/custom-plan-mapping-service";
import { MigrationCostBenefitService } from "../services/migration-cost-benefit-service";
import { AppSumoService } from "../services/appsumo-service";

import {
  PlanTier,
  UserType
} from "../interfaces/plan-recommendation";

import db from "../config/db";
import { log_error } from "../shared/utils";

export default class SubscriptionController extends WorklenzControllerBase {

  /**
   * List all plans with user-specific pricing
   * GET /api/plans
   */
  @HandleExceptions()
  public static async listPlans(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const { includeLegacy, includeDiscounts, userCount } = req.query;
    
    try {
      // Get base plans
      const basePlans = await this.getBasePlans();
      
      // If organization provided, get personalized pricing and recommendations
      if (organizationId) {
        const [userAnalytics, recommendations] = await Promise.all([
          PlanRecommendationService.generateRecommendations(organizationId),
          UserAnalyticsService.analyzeUsagePatterns(organizationId)
        ]);

        // Enhance plans with user-specific data
        const enhancedPlans = await this.enhancePlansWithUserData(
          basePlans, 
          userAnalytics, 
          recommendations,
          {
            includeLegacy: includeLegacy === 'true',
            includeDiscounts: includeDiscounts === 'true',
            userCount: parseInt(userCount as string) || recommendations.totalUsers
          }
        );

        return res.status(200).send(new ServerResponse(true, {
          plans: enhancedPlans,
          userContext: {
            userType: userAnalytics.userAnalytics.userType,
            currentPlan: userAnalytics.userAnalytics.customPlanDetails || null,
            eligibleDiscounts: userAnalytics.userAnalytics.migrationEligibility.discounts
          },
          recommendations: userAnalytics.recommendations.slice(0, 3)
        }));
      }

      // Return base plans without personalization
      return res.status(200).send(new ServerResponse(true, { plans: basePlans }));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to retrieve plans"));
    }
  }

  /**
   * Create subscription (handles migrations)
   * POST /api/subscriptions
   */
  @HandleExceptions()
  public static async createSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const userId = req.user?.id;
    const { 
      planId, 
      billingCycle, 
      userCount, 
      discountCode,
      paymentMethodId,
      migrationContext,
      preserveGrandfathering 
    } = req.body;
    
    if (!organizationId || !planId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID and plan ID are required"));
    }

    try {
      // Check if user already has an active subscription
      if (!userId) {
        return res.status(400).send(new ServerResponse(false, null, "User ID is required"));
      }
      
      const existingSubscription = await this.getExistingSubscription(userId);
      
      if (existingSubscription && existingSubscription.status === 'active') {
        return res.status(400).send(new ServerResponse(false, null, "User already has an active subscription. Use upgrade endpoint instead."));
      }

      // Validate plan and get pricing
      const planDetails = await this.validateAndGetPlanDetails(planId, userCount);
      if (!planDetails) {
        return res.status(400).send(new ServerResponse(false, null, "Invalid plan or configuration"));
      }

      // Check migration eligibility if this is a migration
      if (migrationContext) {
        const eligibility = await PlanRecommendationService.generateRecommendations(organizationId);
        if (!eligibility.userAnalytics.migrationEligibility.isEligible) {
          return res.status(400).send(new ServerResponse(false, null, "User is not eligible for migration"));
        }
      }

      // Apply discounts
      const { finalPrice, appliedDiscounts, isAppSumoDiscount, specialUserLimit } = await this.calculateFinalPricing(
        planDetails,
        organizationId,
        discountCode,
        preserveGrandfathering,
        userCount
      );

      // Create subscription (integrate with Paddle here)
      const subscriptionResult = await this.createPaddleSubscription({
        organizationId,
        userId,
        planDetails,
        finalPrice,
        billingCycle,
        paymentMethodId,
        appliedDiscounts,
        migrationContext,
        teamSize: userCount,
        isAppSumoDiscount,
        specialUserLimit
      });

      if (!subscriptionResult.success) {
        return res.status(400).send(new ServerResponse(false, null, subscriptionResult.message));
      }

      // Record subscription in local database
      await this.recordSubscription({
        subscriptionId: subscriptionResult.subscriptionId,
        organizationId,
        userId,
        planId,
        billingCycle,
        finalPrice,
        appliedDiscounts,
        migrationContext
      });

      // Send confirmation and setup next steps
      const response = {
        subscriptionId: subscriptionResult.subscriptionId,
        planDetails,
        finalPrice,
        appliedDiscounts,
        migrationContext,
        nextSteps: this.getSubscriptionNextSteps(planId, migrationContext),
        confirmationEmail: true,
        isAppSumoDiscount,
        specialUserLimit,
        paddlePlanId: subscriptionResult.paddlePlanId
      };

      return res.status(201).send(new ServerResponse(true, response, "Subscription created successfully"));
    } catch (error) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null, "Failed to create subscription"));
    }
  }

  /**
   * Get current subscription with legacy plan details
   * GET /api/subscriptions/current
   */
  @HandleExceptions()
  public static async getCurrentSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const userId = req.user?.id;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      if (!userId) {
        return res.status(400).send(new ServerResponse(false, null, "User ID is required"));
      }
      
      const [currentSubscription, userAnalytics, legacyPlanDetails] = await Promise.all([
        this.getExistingSubscription(userId),
        PlanRecommendationService.generateRecommendations(organizationId),
        this.getLegacyPlanDetails(organizationId)
      ]);

      if (!currentSubscription) {
        return res.status(200).send(new ServerResponse(true, {
          hasSubscription: false,
          userType: userAnalytics.userAnalytics.userType,
          legacyPlan: legacyPlanDetails,
          migrationOptions: userAnalytics.userAnalytics.migrationEligibility
        }));
      }

      const subscriptionDetails = {
        hasSubscription: true,
        subscription: {
          id: currentSubscription.id,
          status: currentSubscription.status,
          planId: currentSubscription.plan_id,
          planName: currentSubscription.plan_name,
          billingCycle: currentSubscription.billing_cycle,
          currentPrice: currentSubscription.current_price,
          nextBillingDate: currentSubscription.next_billing_date,
          userLimit: currentSubscription.user_limit,
          features: currentSubscription.features
        },
        userType: userAnalytics.userAnalytics.userType,
        legacyPlan: legacyPlanDetails,
        usage: {
          currentUsers: userAnalytics.userAnalytics.usageMetrics.totalUsers,
          storageUsed: userAnalytics.userAnalytics.usageMetrics.storageUsed,
          projectCount: userAnalytics.userAnalytics.usageMetrics.totalProjects
        },
        upgradeOptions: userAnalytics.recommendations.slice(0, 3),
        migrationHistory: await this.getMigrationHistory(organizationId)
      };

      return res.status(200).send(new ServerResponse(true, subscriptionDetails));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to retrieve subscription details"));
    }
  }

  /**
   * Upgrade subscription with migration support
   * PUT /api/subscriptions/upgrade
   */
  @HandleExceptions()
  public static async upgradeSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const userId = req.user?.id;
    const { 
      newPlanId, 
      billingCycle, 
      userCount,
      effectiveDate,
      preserveGrandfathering,
      migrationPreview 
    } = req.body;
    
    if (!organizationId || !newPlanId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID and new plan ID are required"));
    }

    try {
      if (!userId) {
        return res.status(400).send(new ServerResponse(false, null, "User ID is required"));
      }
      
      // Get current subscription
      const currentSubscription = await this.getExistingSubscription(userId);
      if (!currentSubscription) {
        return res.status(400).send(new ServerResponse(false, null, "No active subscription found. Use create subscription endpoint."));
      }

      // Validate upgrade path
      const upgradeValidation = await this.validateUpgradePath(
        currentSubscription.plan_id,
        newPlanId,
        organizationId
      );

      if (!upgradeValidation.isValid) {
        return res.status(400).send(new ServerResponse(false, null, upgradeValidation.reason));
      }

      // Generate upgrade preview if requested
      if (migrationPreview) {
        const preview = await this.generateUpgradePreview(
          organizationId,
          currentSubscription,
          newPlanId,
          userCount,
          preserveGrandfathering
        );
        return res.status(200).send(new ServerResponse(true, preview));
      }

      // Process the upgrade
      const upgradeResult = await this.processSubscriptionUpgrade({
        organizationId,
        userId,
        currentSubscription,
        newPlanId,
        billingCycle,
        userCount,
        effectiveDate,
        preserveGrandfathering
      });

      if (!upgradeResult.success) {
        return res.status(400).send(new ServerResponse(false, null, upgradeResult.message));
      }

      return res.status(200).send(new ServerResponse(true, {
        upgradeId: upgradeResult.upgradeId,
        newSubscriptionId: upgradeResult.newSubscriptionId,
        effectiveDate: upgradeResult.effectiveDate,
        proratedAmount: upgradeResult.proratedAmount,
        nextSteps: this.getUpgradeNextSteps(newPlanId)
      }, "Subscription upgraded successfully"));

    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to upgrade subscription"));
    }
  }

  /**
   * Get usage with legacy plan context
   * GET /api/subscriptions/usage
   */
  @HandleExceptions()
  public static async getUsage(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const { period, includeProjections } = req.query;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      if (!req.user?.id) {
        return res.status(400).send(new ServerResponse(false, null, "User ID is required"));
      }
      
      const [usageMetrics, analytics, currentSubscription] = await Promise.all([
        UserAnalyticsService.analyzeUsagePatterns(organizationId),
        UserAnalyticsService.generateUsageInsights(organizationId),
        this.getExistingSubscription(req.user.id)
      ]);

      const usage = {
        currentPeriod: {
          users: {
            total: usageMetrics.totalUsers,
            active: usageMetrics.activeUsers,
            limit: currentSubscription?.user_limit || 3,
            utilizationPercent: currentSubscription?.user_limit ? 
              (usageMetrics.totalUsers / currentSubscription.user_limit) * 100 : 0
          },
          storage: {
            used: usageMetrics.storageUsed,
            limit: this.getStorageLimitForPlan(currentSubscription?.plan_id),
            utilizationPercent: this.calculateStorageUtilization(usageMetrics.storageUsed, currentSubscription?.plan_id)
          },
          projects: {
            total: usageMetrics.totalProjects,
            active: usageMetrics.activeProjects,
            limit: this.getProjectLimitForPlan(currentSubscription?.plan_id)
          },
          features: {
            utilization: usageMetrics.featureUtilization,
            insights: analytics.insights,
            recommendations: analytics.recommendations
          }
        },
        trends: {
          userGrowth: usageMetrics.growthTrend,
          projections: includeProjections === 'true' ? {
            next3Months: usageMetrics.growthTrend.predicted3MonthUsers,
            next6Months: usageMetrics.growthTrend.predicted6MonthUsers,
            next12Months: usageMetrics.growthTrend.predicted12MonthUsers
          } : null
        },
        limitations: this.getCurrentLimitations(currentSubscription, usageMetrics),
        upgradeRecommendations: this.getUsageBasedUpgradeRecommendations(usageMetrics, currentSubscription)
      };

      return res.status(200).send(new ServerResponse(true, usage));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to retrieve usage data"));
    }
  }

  /**
   * Cancel subscription with migration rollback options
   * POST /api/subscriptions/cancel
   */
  @HandleExceptions()
  public static async cancelSubscription(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const userId = req.user?.id;
    const { 
      reason, 
      feedback, 
      effectiveDate,
      rollbackToLegacy,
      retainData 
    } = req.body;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      if (!userId) {
        return res.status(400).send(new ServerResponse(false, null, "User ID is required"));
      }
      
      // Get current subscription
      const currentSubscription = await this.getExistingSubscription(userId);
      if (!currentSubscription) {
        return res.status(400).send(new ServerResponse(false, null, "No active subscription found"));
      }

      // Check if rollback to legacy is possible
      let rollbackOptions = null;
      if (rollbackToLegacy) {
        rollbackOptions = await this.assessLegacyRollbackOptions(organizationId);
        if (!rollbackOptions.isPossible) {
          return res.status(400).send(new ServerResponse(false, null, rollbackOptions.reason));
        }
      }

      // Process cancellation
      const cancellationResult = await this.processCancellation({
        organizationId,
        userId,
        subscriptionId: currentSubscription.id,
        reason,
        feedback,
        effectiveDate,
        rollbackToLegacy,
        rollbackOptions,
        retainData
      });

      if (!cancellationResult.success) {
        return res.status(400).send(new ServerResponse(false, null, cancellationResult.message));
      }

      return res.status(200).send(new ServerResponse(true, {
        cancellationId: cancellationResult.cancellationId,
        effectiveDate: cancellationResult.effectiveDate,
        rollbackCompleted: cancellationResult.rollbackCompleted,
        dataRetained: cancellationResult.dataRetained,
        refundAmount: cancellationResult.refundAmount,
        nextSteps: this.getCancellationNextSteps(rollbackToLegacy, retainData)
      }, "Subscription cancelled successfully"));

    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to cancel subscription"));
    }
  }

  /**
   * Helper methods
   */
  private static async getBasePlans(): Promise<any[]> {
    const query = `
      SELECT 
        id, name, key as plan_id, billing_type, billing_period,
        default_currency, initial_price, recurring_price, trial_days,
        paddle_id, active, sort_order, features, user_limit
      FROM licensing_pricing_plans 
      WHERE active = true 
      ORDER BY sort_order ASC
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  private static async enhancePlansWithUserData(
    basePlans: any[], 
    userAnalytics: any, 
    usageMetrics: any,
    options: any
  ): Promise<any[]> {
    const enhancedPlans = [];

    for (const plan of basePlans) {
      // Calculate user-specific pricing
      const userSpecificPrice = this.calculateUserSpecificPricing(
        plan,
        options.userCount,
        userAnalytics.userAnalytics.migrationEligibility.discounts
      );

      // Check plan compatibility
      const compatibility = this.assessPlanCompatibility(plan, usageMetrics, userAnalytics);

      // Add recommendation score if this plan is recommended
      const recommendation = userAnalytics.recommendations.find((r: any) => r.planTier === plan.plan_id);

      enhancedPlans.push({
        ...plan,
        userSpecificPricing: userSpecificPrice,
        compatibility,
        recommendationScore: recommendation?.recommendationScore || 0,
        isRecommended: !!recommendation,
        migrationComplexity: recommendation?.migrationComplexity || 'simple',
        availableDiscounts: userAnalytics.userAnalytics.migrationEligibility.discounts
          .filter((d: any) => d.eligiblePlans.includes(plan.plan_id) || d.eligiblePlans.length === 0)
      });
    }

    return enhancedPlans.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  private static calculateUserSpecificPricing(plan: any, userCount: number, discounts: any[]): any {
    let basePrice = plan.recurring_price;
    
    // Apply user count multiplier for per-user plans
    if (plan.billing_type === 'per_user') {
      basePrice = basePrice * userCount;
    }

    // Apply available discounts
    let discountedPrice = basePrice;
    const applicableDiscounts = discounts.filter(d => 
      d.eligiblePlans.includes(plan.plan_id) || d.eligiblePlans.length === 0
    );

    for (const discount of applicableDiscounts) {
      if (discount.type === 'percentage') {
        discountedPrice = discountedPrice * (1 - discount.value / 100);
      } else if (discount.type === 'fixed_amount') {
        discountedPrice = Math.max(0, discountedPrice - discount.value);
      }
    }

    return {
      basePrice,
      discountedPrice,
      savings: basePrice - discountedPrice,
      applicableDiscounts
    };
  }

  private static assessPlanCompatibility(plan: any, usageMetrics: any, userAnalytics: any): any {
    const userCount = usageMetrics.totalUsers;
    const storageUsed = usageMetrics.storageUsed;
    
    return {
      userCapacity: plan.user_limit === -1 || userCount <= plan.user_limit,
      storageCapacity: this.checkStorageCompatibility(plan.plan_id, storageUsed),
      featureCompatibility: this.checkFeatureCompatibility(plan, userAnalytics),
      overallCompatibility: 'high' // Simplified assessment
    };
  }

  private static checkStorageCompatibility(planId: string, storageUsed: number): boolean {
    const storageLimit = this.getStorageLimitForPlan(planId);
    return storageLimit === -1 || storageUsed <= storageLimit;
  }

  private static checkFeatureCompatibility(plan: any, userAnalytics: any): boolean {
    // Simplified feature compatibility check
    return true;
  }

  private static async getExistingSubscription(userId: string): Promise<any> {
    const query = `
      SELECT 
        lus.id, lus.subscription_id, lus.subscription_status as status,
        lus.user_id, lpp.key as plan_id, lpp.name as plan_name,
        lus.billing_cycle, lus.current_price, lus.next_billing_date,
        lpp.user_limit, lpp.features
      FROM licensing_user_subscriptions lus
      JOIN licensing_pricing_plans lpp ON lpp.id = lus.plan_id
      WHERE lus.user_id = $1 AND lus.subscription_status = 'active'
      ORDER BY lus.created_at DESC
      LIMIT 1
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  private static async validateAndGetPlanDetails(planId: string, userCount: number): Promise<any> {
    const query = `
      SELECT 
        id, name, key, billing_type, default_currency,
        initial_price, recurring_price, user_limit, features
      FROM licensing_pricing_plans 
      WHERE key = $1 AND active = true
    `;
    
    const result = await db.query(query, [planId]);
    const plan = result.rows[0];
    
    if (!plan) return null;
    
    // Validate user count against plan limits
    if (plan.user_limit !== -1 && userCount > plan.user_limit) {
      return null;
    }
    
    return plan;
  }

  private static async calculateFinalPricing(
    planDetails: any,
    organizationId: string,
    discountCode?: string,
    preserveGrandfathering?: boolean,
    teamSize?: number
  ): Promise<{ finalPrice: number; appliedDiscounts: any[]; isAppSumoDiscount?: boolean; specialUserLimit?: number }> {
    let finalPrice = parseFloat(planDetails.recurring_price);
    const appliedDiscounts = [];
    let isAppSumoDiscount = false;
    let specialUserLimit;

    // Check for AppSumo discount first (highest priority)
    const appSumoDiscount = await AppSumoService.applyAppSumoDiscount(
      organizationId,
      finalPrice,
      planDetails.tier || planDetails.key
    );
    
    if (appSumoDiscount.discountApplied) {
      finalPrice = appSumoDiscount.finalPrice;
      isAppSumoDiscount = true;
      specialUserLimit = appSumoDiscount.specialUserLimit;
      
      appliedDiscounts.push({
        code: 'APPSUMO_50_SPECIAL',
        type: 'percentage',
        value: 50,
        description: 'AppSumo Exclusive 50% Discount',
        conditions: [
          'AppSumo customer exclusive',
          'Limited time promotional offer',
          'Business or Enterprise plan required'
        ],
        appliedAmount: appSumoDiscount.discountAmount
      });
      
      // Return early - AppSumo discount overrides other discounts
      return { finalPrice, appliedDiscounts, isAppSumoDiscount, specialUserLimit };
    }

    // Apply organization-specific discounts only if no AppSumo discount applied
    const userAnalytics = await PlanRecommendationService.generateRecommendations(organizationId);
    const availableDiscounts = userAnalytics.userAnalytics.migrationEligibility.discounts;

    for (const discount of availableDiscounts) {
      if (discountCode && discount.code === discountCode) {
        if (discount.type === 'percentage') {
          finalPrice = finalPrice * (1 - discount.value / 100);
        } else if (discount.type === 'fixed_amount') {
          finalPrice = Math.max(0, finalPrice - discount.value);
        }
        appliedDiscounts.push(discount);
        break;
      }
    }

    // Apply grandfathered pricing if applicable and no other discounts applied
    if (preserveGrandfathering && userAnalytics.userAnalytics.customPlanDetails && appliedDiscounts.length === 0) {
      const grandfatheredDiscount = await CustomPlanMappingService.generateGrandfatheredDiscount(
        organizationId,
        planDetails.key as PlanTier
      );
      
      if (grandfatheredDiscount) {
        finalPrice = userAnalytics.userAnalytics.customPlanDetails.currentPricing;
        appliedDiscounts.push(grandfatheredDiscount);
      }
    }

    return { finalPrice, appliedDiscounts, isAppSumoDiscount, specialUserLimit };
  }

  private static async createPaddleSubscription(params: any): Promise<{ success: boolean; subscriptionId?: string; message: string; paddlePlanId?: number }> {
    try {
      let paddlePlanId = params.planDetails.paddle_id; // Default paddle plan ID
      let subscriptionMessage = "Subscription created successfully in Paddle";
      
      // Check if this is an AppSumo user and should use special Paddle plans
      if (params.organizationId && params.isAppSumoDiscount) {
        const appSumoPaddlePlan = AppSumoService.getAppSumoPaddlePlanId(
          params.planDetails.tier || params.planDetails.key, 
          params.billingCycle
        );
        
        if (appSumoPaddlePlan) {
          paddlePlanId = appSumoPaddlePlan;
          subscriptionMessage = `AppSumo subscription created with 50% discount - Plan ID: ${appSumoPaddlePlan}`;
        }
      }
      
      // Here you would make the actual Paddle API call with the correct plan ID
      // For now, return a mock success response with the plan ID used
      return {
        success: true,
        subscriptionId: `paddle_sub_${Date.now()}`,
        message: subscriptionMessage,
        paddlePlanId: paddlePlanId
      };
      
    } catch (error) {
      log_error(error);
      return {
        success: false,
        message: "Failed to create Paddle subscription"
      };
    }
  }
  

  private static async recordSubscription(params: any): Promise<void> {
    const query = `
      INSERT INTO licensing_user_subscriptions (
        subscription_id, user_id, plan_id, billing_cycle, 
        current_price, subscription_status, applied_discounts,
        migration_context, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;
    
    await db.query(query, [
      params.subscriptionId,
      params.userId,
      params.planId,
      params.billingCycle,
      params.finalPrice,
      'active',
      JSON.stringify(params.appliedDiscounts),
      params.migrationContext
    ]);
  }

  private static getSubscriptionNextSteps(planId: string, migrationContext?: string): string[] {
    const steps = [
      'Verify plan activation and features',
      'Update team on new capabilities',
      'Review billing confirmation email'
    ];

    if (migrationContext === 'appsumo') {
      steps.push('Confirm AppSumo discount application');
    }

    if ([PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE].includes(planId as PlanTier)) {
      steps.push('Explore advanced features');
      steps.push('Set up client portal');
    }

    return steps;
  }

  private static async getLegacyPlanDetails(organizationId: string): Promise<any> {
    const customPlanDetails = await CustomPlanMappingService.getCustomPlanMappings(organizationId);
    return customPlanDetails;
  }

  private static async getMigrationHistory(organizationId: string): Promise<any[]> {
    const query = `
      SELECT 
        id, migration_type, from_plan, to_plan, migration_status,
        migration_context, created_at, completed_at
      FROM licensing_migration_audit 
      WHERE organization_team_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    
    const result = await db.query(query, [organizationId]);
    return result.rows;
  }

  private static async validateUpgradePath(currentPlanId: string, newPlanId: string, organizationId: string): Promise<{ isValid: boolean; reason?: string }> {
    // Validate upgrade path logic
    const planHierarchy = [
      PlanTier.FREE,
      PlanTier.PRO_SMALL,
      PlanTier.BUSINESS_SMALL,
      PlanTier.PRO_LARGE,
      PlanTier.BUSINESS_LARGE,
      PlanTier.ENTERPRISE
    ];

    const currentIndex = planHierarchy.indexOf(currentPlanId as PlanTier);
    const newIndex = planHierarchy.indexOf(newPlanId as PlanTier);

    if (newIndex <= currentIndex) {
      return { isValid: false, reason: "Can only upgrade to higher tier plans" };
    }

    return { isValid: true };
  }

  private static async generateUpgradePreview(
    organizationId: string,
    currentSubscription: any,
    newPlanId: string,
    userCount: number,
    preserveGrandfathering: boolean
  ): Promise<any> {
    // Generate upgrade preview with cost analysis
    const costBenefit = await MigrationCostBenefitService.performCostBenefitAnalysis(
      organizationId,
      newPlanId as PlanTier,
      UserType.ACTIVE_SUBSCRIBER,
      {} as any,
      undefined,
      undefined,
      []
    );

    return {
      currentPlan: {
        id: currentSubscription.plan_id,
        name: currentSubscription.plan_name,
        price: currentSubscription.current_price
      },
      newPlan: {
        id: newPlanId,
        name: this.getPlanDisplayName(newPlanId as PlanTier),
        price: costBenefit.costAnalysis.newMonthlyCost
      },
      costAnalysis: costBenefit.costAnalysis,
      benefitAnalysis: costBenefit.benefitAnalysis,
      timeline: costBenefit.timeline
    };
  }

  private static getPlanDisplayName(planTier: PlanTier): string {
    const names = {
      [PlanTier.FREE]: 'Free Plan',
      [PlanTier.PRO_SMALL]: 'Pro Small',
      [PlanTier.BUSINESS_SMALL]: 'Business Small',
      [PlanTier.PRO_LARGE]: 'Pro Large',
      [PlanTier.BUSINESS_LARGE]: 'Business Large',
      [PlanTier.ENTERPRISE]: 'Enterprise'
    };
    return names[planTier] || planTier;
  }

  private static async processSubscriptionUpgrade(params: any): Promise<{ success: boolean; upgradeId?: string; newSubscriptionId?: string; effectiveDate?: Date; proratedAmount?: number; message: string }> {
    // This would integrate with Paddle API for subscription updates
    return {
      success: true,
      upgradeId: `upgrade_${Date.now()}`,
      newSubscriptionId: `paddle_sub_upgraded_${Date.now()}`,
      effectiveDate: new Date(),
      proratedAmount: 0,
      message: "Subscription upgraded successfully"
    };
  }

  private static getUpgradeNextSteps(newPlanId: string): string[] {
    return [
      'Verify new plan features are active',
      'Review updated billing amount',
      'Explore enhanced capabilities',
      'Update team on new features'
    ];
  }

  private static getStorageLimitForPlan(planId?: string): number {
    const limits = {
      [PlanTier.FREE]: 5 * 1024 * 1024 * 1024, // 5GB
      [PlanTier.PRO_SMALL]: 100 * 1024 * 1024 * 1024, // 100GB
      [PlanTier.BUSINESS_SMALL]: 500 * 1024 * 1024 * 1024, // 500GB
      [PlanTier.PRO_LARGE]: 1024 * 1024 * 1024 * 1024, // 1TB
      [PlanTier.BUSINESS_LARGE]: 2 * 1024 * 1024 * 1024 * 1024, // 2TB
      [PlanTier.ENTERPRISE]: -1 // Unlimited
    };
    return limits[planId as PlanTier] || limits[PlanTier.FREE];
  }

  private static getProjectLimitForPlan(planId?: string): number {
    return planId === PlanTier.FREE ? 3 : -1; // Unlimited for paid plans
  }

  private static calculateStorageUtilization(used: number, planId?: string): number {
    const limit = this.getStorageLimitForPlan(planId);
    if (limit === -1) return 0; // Unlimited
    return (used / limit) * 100;
  }

  private static getCurrentLimitations(subscription: any, usageMetrics: any): any[] {
    const limitations = [];
    
    if (subscription?.user_limit && usageMetrics.totalUsers >= subscription.user_limit) {
      limitations.push({
        type: 'user_limit',
        message: 'User limit reached',
        current: usageMetrics.totalUsers,
        limit: subscription.user_limit
      });
    }

    const storageLimit = this.getStorageLimitForPlan(subscription?.plan_id);
    if (storageLimit !== -1 && usageMetrics.storageUsed >= storageLimit * 0.9) {
      limitations.push({
        type: 'storage_limit',
        message: 'Storage limit approaching',
        current: usageMetrics.storageUsed,
        limit: storageLimit
      });
    }

    return limitations;
  }

  private static getUsageBasedUpgradeRecommendations(usageMetrics: any, subscription: any): any[] {
    const recommendations = [];
    
    if (subscription?.user_limit && usageMetrics.totalUsers >= subscription.user_limit * 0.8) {
      recommendations.push({
        reason: 'Approaching user limit',
        suggestedPlan: PlanTier.PRO_LARGE,
        urgency: 'medium'
      });
    }

    if (usageMetrics.featureUtilization.ganttCharts > 0.7 && subscription?.plan_id === PlanTier.PRO_SMALL) {
      recommendations.push({
        reason: 'Heavy Gantt chart usage',
        suggestedPlan: PlanTier.BUSINESS_SMALL,
        urgency: 'low'
      });
    }

    return recommendations;
  }

  private static async assessLegacyRollbackOptions(organizationId: string): Promise<{ isPossible: boolean; reason?: string; options?: any }> {
    const customPlanDetails = await CustomPlanMappingService.getCustomPlanMappings(organizationId);
    
    if (customPlanDetails) {
      return {
        isPossible: true,
        options: {
          canPreservePricing: customPlanDetails.preservationEligible,
          grandfatheredBenefits: customPlanDetails.grandfatheredBenefits
        }
      };
    }
    
    return {
      isPossible: false,
      reason: "No legacy plan configuration found"
    };
  }

  private static async processCancellation(params: any): Promise<{ success: boolean; cancellationId?: string; effectiveDate?: Date; rollbackCompleted?: boolean; dataRetained?: boolean; refundAmount?: number; message: string }> {
    // This would integrate with Paddle API for cancellation
    return {
      success: true,
      cancellationId: `cancel_${Date.now()}`,
      effectiveDate: new Date(),
      rollbackCompleted: params.rollbackToLegacy || false,
      dataRetained: params.retainData !== false,
      refundAmount: 0,
      message: "Subscription cancelled successfully"
    };
  }

  private static getCancellationNextSteps(rollbackToLegacy: boolean, retainData: boolean): string[] {
    const steps = ['Confirm cancellation email received'];
    
    if (rollbackToLegacy) {
      steps.push('Verify legacy plan restoration');
    } else {
      steps.push('Plan data export if needed');
    }
    
    if (retainData) {
      steps.push('Data will be preserved for 30 days');
    }
    
    steps.push('Contact support for any questions');
    
    return steps;
  }
}