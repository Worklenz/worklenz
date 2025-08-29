import db from "../config/db";
import { log_error } from "../shared/utils";
import {
  UserAnalytics,
  PlanRecommendation,
  PlanRecommendationResponse,
  UserType,
  PlanTier,
  MigrationEligibility,
  AppSumoStatus,
  CustomPlanDetails,
  UsageMetrics,
  FeatureUtilization,
  GrowthTrend,
  LegacyPlan,
  PlanPricing,
  PlanEquivalency,
  MatchFactor,
  MatchReason,
  UpgradeCategory,
  UpgradeReason,
  MigrationDiscount,
  DiscountType,
  UrgentAction,
  MigrationSummary,
  SpecialOffer
} from "../interfaces/plan-recommendation";

export class PlanRecommendationService {
  private static readonly PLAN_WEIGHTS = {
    [MatchFactor.USER_COUNT]: 0.3,
    [MatchFactor.FEATURE_REQUIREMENTS]: 0.25,
    [MatchFactor.BUDGET_ALIGNMENT]: 0.2,
    [MatchFactor.USAGE_PATTERNS]: 0.15,
    [MatchFactor.GROWTH_TRAJECTORY]: 0.1
  };

  private static readonly PLAN_PRICING: Record<PlanTier, PlanPricing> = {
    [PlanTier.FREE]: { monthly: 0, annual: 0, maxUsers: 3 },
    [PlanTier.PRO_SMALL]: { monthly: 9.99, annual: 6.99, maxUsers: 5 },
    [PlanTier.BUSINESS_SMALL]: { monthly: 14.99, annual: 11.99, maxUsers: 5 },
    [PlanTier.PRO_LARGE]: { monthly: 69, annual: 69, baseUsers: 15, extraUserCost: 5.99, maxUsers: 50 },
    [PlanTier.BUSINESS_LARGE]: { monthly: 99, annual: 99, baseUsers: 20, extraUserCost: 5.99, maxUsers: 100 },
    [PlanTier.ENTERPRISE]: { monthly: 349, annual: 349, maxUsers: -1 }
  };

  /**
   * Generate comprehensive plan recommendations for a user
   */
  public static async generateRecommendations(organizationId: string): Promise<PlanRecommendationResponse> {
    try {
      const userAnalytics = await this.analyzeUser(organizationId);
      const recommendations = await this.calculateRecommendations(userAnalytics);
      const urgentActions = await this.identifyUrgentActions(userAnalytics);
      const migrationSummary = await this.generateMigrationSummary(userAnalytics, recommendations);
      const specialOffers = await this.getSpecialOffers(userAnalytics);

      return {
        userAnalytics,
        recommendations,
        urgentActions,
        migrationSummary,
        specialOffers
      };
    } catch (error) {
      log_error(error);
      throw new Error("Failed to generate plan recommendations");
    }
  }

  /**
   * Analyze user type, usage patterns, and current plan
   */
  private static async analyzeUser(organizationId: string): Promise<UserAnalytics> {
    const [userType, usageMetrics, migrationEligibility, appSumoStatus, customPlanDetails] = await Promise.all([
      this.determineUserType(organizationId),
      this.calculateUsageMetrics(organizationId),
      this.assessMigrationEligibility(organizationId),
      this.getAppSumoStatus(organizationId),
      this.getCustomPlanDetails(organizationId)
    ]);

    return {
      organizationId,
      userType,
      usageMetrics,
      migrationEligibility,
      appSumoStatus,
      customPlanDetails
    };
  }

  /**
   * Determine user type based on subscription history and current status
   */
  private static async determineUserType(organizationId: string): Promise<UserType> {
    const query = `
      SELECT 
        o.user_type,
        o.trial_expire_date,
        EXISTS(SELECT 1 FROM licensing_custom_subs lcs WHERE lcs.user_id = o.user_id) as has_custom,
        EXISTS(SELECT 1 FROM licensing_coupon_codes lcc WHERE lcc.redeemed_by = o.user_id AND lcc.code LIKE '%APPSUMO%') as is_appsumo,
        lus.subscription_status,
        lus.subscription_id
      FROM organizations o
      LEFT JOIN licensing_user_subscriptions lus ON lus.user_id = o.user_id
      WHERE o.id = $1
    `;
    
    const result = await db.query(query, [organizationId]);
    const data = result.rows[0];

    if (!data) return UserType.NEW_USER;

    if (data.is_appsumo) return UserType.APPSUMO;
    if (data.has_custom) return UserType.CUSTOM_PLAN;
    if (data.trial_expire_date && new Date(data.trial_expire_date) > new Date()) return UserType.TRIAL;
    if (data.subscription_status === 'active') return UserType.ACTIVE_SUBSCRIBER;
    
    return UserType.FREE;
  }

  /**
   * Calculate comprehensive usage metrics
   */
  private static async calculateUsageMetrics(organizationId: string): Promise<UsageMetrics> {
    const baseMetricsQuery = `
      SELECT 
        COUNT(DISTINCT tm.email) as total_users,
        COUNT(DISTINCT CASE WHEN tm.active = true THEN tm.email END) as active_users,
        COUNT(DISTINCT p.id) as total_projects,
        COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_projects,
        COALESCE(SUM(ta.size), 0) as storage_used
      FROM organizations o
      JOIN teams t ON t.user_id = o.user_id
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN projects p ON p.team_id = t.id
      LEFT JOIN task_attachments ta ON ta.team_id = t.id
      WHERE o.id = $1
    `;

    const featureUsageQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN tl.created_at > NOW() - INTERVAL '30 days' THEN tl.task_id END)::float / NULLIF(COUNT(DISTINCT tasks.id), 0) as time_tracking_usage,
        COUNT(DISTINCT CASE WHEN p.gantt_enabled = true THEN p.id END)::float / NULLIF(COUNT(DISTINCT p.id), 0) as gantt_usage,
        COUNT(DISTINCT cf.id)::float / (COUNT(DISTINCT p.id) * 5) as custom_fields_usage
      FROM organizations o
      JOIN teams t ON t.user_id = o.user_id
      LEFT JOIN projects p ON p.team_id = t.id
      LEFT JOIN tasks ON tasks.project_id = p.id
      LEFT JOIN task_work_log tl ON tl.task_id = tasks.id
      LEFT JOIN custom_fields cf ON cf.project_id = p.id
      WHERE o.id = $1
    `;

    const [baseResult, featureResult] = await Promise.all([
      db.query(baseMetricsQuery, [organizationId]),
      db.query(featureUsageQuery, [organizationId])
    ]);

    const baseData = baseResult.rows[0];
    const featureData = featureResult.rows[0];

    const featureUtilization: FeatureUtilization = {
      ganttCharts: Number(featureData.gantt_usage) || 0,
      timeTracking: Number(featureData.time_tracking_usage) || 0,
      customFields: Number(featureData.custom_fields_usage) || 0,
      reporting: 0.5, // Default estimate
      integrations: 0.2, // Default estimate
      advancedPermissions: 0.3, // Default estimate
      clientPortal: 0.1, // Default estimate
      resourceManagement: 0.4 // Default estimate
    };

    // Calculate growth trends (simplified)
    const growthTrend: GrowthTrend = {
      userGrowthRate: 0.1, // 10% monthly growth estimate
      projectGrowthRate: 0.15,
      storageGrowthRate: 0.2,
      predicted3MonthUsers: Math.ceil(baseData.total_users * 1.33),
      predicted6MonthUsers: Math.ceil(baseData.total_users * 1.77),
      predicted12MonthUsers: Math.ceil(baseData.total_users * 3.14)
    };

    return {
      totalUsers: Number(baseData.total_users) || 0,
      activeUsers: Number(baseData.active_users) || 0,
      totalProjects: Number(baseData.total_projects) || 0,
      activeProjects: Number(baseData.active_projects) || 0,
      storageUsed: Number(baseData.storage_used) || 0,
      averageProjectComplexity: 0.6, // Default calculated value
      teamCollaborationIndex: 0.7, // Default calculated value
      featureUtilization,
      growthTrend,
      peakUsagePeriods: [] // Would be calculated from historical data
    };
  }

  /**
   * Assess migration eligibility and available discounts
   */
  private static async assessMigrationEligibility(organizationId: string): Promise<MigrationEligibility> {
    const query = `
      SELECT 
        o.user_type,
        o.trial_expire_date,
        lus.subscription_status,
        lus.subscription_id,
        EXISTS(SELECT 1 FROM licensing_custom_subs WHERE user_id = o.user_id) as has_custom_plan
      FROM organizations o
      LEFT JOIN licensing_user_subscriptions lus ON lus.user_id = o.user_id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [organizationId]);
    const data = result.rows[0];

    const discounts = await this.getAvailableDiscounts(data.user_type, organizationId);
    const eligiblePlans = this.getEligiblePlans(data.user_type);
    
    return {
      isEligible: true,
      eligiblePlans,
      recommendedPlan: eligiblePlans[0] || PlanTier.PRO_SMALL,
      discounts,
      preservedBenefits: data.has_custom_plan ? ['Current pricing structure', 'Custom feature set'] : [],
      upgradeReasons: this.generateUpgradeReasons(data.user_type)
    };
  }

  /**
   * Get AppSumo specific status and offers
   */
  private static async getAppSumoStatus(organizationId: string): Promise<AppSumoStatus | undefined> {
    const query = `
      SELECT 
        lam.created_at as purchase_date,
        lam.migration_deadline,
        lam.special_discount_rate,
        lam.minimum_tier_required,
        EXTRACT(DAY FROM lam.migration_deadline - NOW())::int as remaining_days
      FROM organizations o
      JOIN licensing_appsumo_migrations lam ON lam.organization_id = o.id
      WHERE o.id = $1 AND lam.migration_deadline > NOW()
    `;

    const result = await db.query(query, [organizationId]);
    if (result.rows.length === 0) return undefined;

    const data = result.rows[0];
    
    return {
      isAppSumoUser: true,
      purchaseDate: data.purchase_date,
      remainingMigrationDays: data.remaining_days,
      eligibleForSpecialDiscount: data.remaining_days > 0,
      minimumPlanTier: data.minimum_tier_required || 'BUSINESS_SMALL',
      specialOfferDiscount: data.special_discount_rate || 50
    };
  }

  /**
   * Get custom plan details for grandfathered users
   */
  private static async getCustomPlanDetails(organizationId: string): Promise<CustomPlanDetails | undefined> {
    const query = `
      SELECT 
        lcs.plan_name,
        lcs.monthly_price,
        lcs.features,
        lcpm.new_plan_tier,
        lcpm.feature_match_percentage,
        lcpm.preserve_pricing
      FROM organizations o
      JOIN licensing_custom_subs lcs ON lcs.user_id = o.user_id
      LEFT JOIN licensing_custom_plan_mappings lcpm ON lcpm.custom_plan_id = lcs.id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [organizationId]);
    if (result.rows.length === 0) return undefined;

    const data = result.rows[0];
    
    // Parse features from JSON or create default structure
    const currentFeatures = typeof data.features === 'string' ? JSON.parse(data.features) : data.features || {};
    
    return {
      currentFeatures: {
        unlimitedProjects: currentFeatures.unlimited_projects || false,
        storageLimit: currentFeatures.storage_limit || 50,
        customFields: currentFeatures.custom_fields || false,
        ganttCharts: currentFeatures.gantt_charts || false,
        timeTracking: currentFeatures.time_tracking || false,
        reporting: currentFeatures.reporting || false,
        integrations: currentFeatures.integrations || false,
        clientPortal: currentFeatures.client_portal || false,
        advancedPermissions: currentFeatures.advanced_permissions || false,
        priority: currentFeatures.priority || 'standard'
      },
      currentPricing: data.monthly_price || 0,
      grandfatheredBenefits: ['Custom pricing', 'Legacy feature set'],
      preservationEligible: data.preserve_pricing || false,
      equivalentNewPlans: data.new_plan_tier ? [{
        newPlanId: data.new_plan_tier,
        featureMatchPercent: data.feature_match_percentage || 80,
        costComparison: {
          currentCost: data.monthly_price,
          newPlanCost: this.PLAN_PRICING[data.new_plan_tier as PlanTier]?.monthly || 0,
          differenceAmount: 0,
          differencePercent: 0
        },
        migrationComplexity: 'moderate',
        recommendationScore: 85
      }] : []
    };
  }

  /**
   * Calculate plan recommendations based on user analytics
   */
  private static async calculateRecommendations(userAnalytics: UserAnalytics): Promise<PlanRecommendation[]> {
    const recommendations: PlanRecommendation[] = [];
    
    // Get all eligible plans based on user type
    const eligiblePlans = this.getEligiblePlansForUserType(userAnalytics.userType, userAnalytics.appSumoStatus);
    
    for (const planTier of eligiblePlans) {
      const recommendation = await this.createPlanRecommendation(planTier, userAnalytics);
      recommendations.push(recommendation);
    }

    // Sort by recommendation score
    return recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Create a detailed plan recommendation
   */
  private static async createPlanRecommendation(planTier: PlanTier, userAnalytics: UserAnalytics): Promise<PlanRecommendation> {
    const planPricing = this.PLAN_PRICING[planTier];
    const userCount = userAnalytics.usageMetrics.totalUsers;
    
    // Calculate cost based on plan structure
    let monthlyCost = planPricing.monthly;
    if (planTier === PlanTier.PRO_LARGE || planTier === PlanTier.BUSINESS_LARGE) {
      const baseUsers = planPricing.baseUsers || 0;
      const extraUsers = Math.max(0, userCount - baseUsers);
      monthlyCost = planPricing.monthly + (extraUsers * (planPricing.extraUserCost || 0));
    } else if (planTier !== PlanTier.FREE && planTier !== PlanTier.ENTERPRISE) {
      monthlyCost = planPricing.monthly * userCount;
    }

    const matchReasons = this.calculateMatchReasons(planTier, userAnalytics);
    const recommendationScore = this.calculateRecommendationScore(matchReasons);
    
    return {
      planId: planTier,
      planName: this.getPlanDisplayName(planTier),
      planTier,
      recommendationScore,
      confidenceLevel: this.calculateConfidenceLevel(matchReasons, userAnalytics),
      matchReasons,
      costAnalysis: {
        currentCost: userAnalytics.customPlanDetails?.currentPricing || 0,
        newPlanCost: monthlyCost,
        differenceAmount: monthlyCost - (userAnalytics.customPlanDetails?.currentPricing || 0),
        differencePercent: userAnalytics.customPlanDetails?.currentPricing ? 
          ((monthlyCost - userAnalytics.customPlanDetails.currentPricing) / userAnalytics.customPlanDetails.currentPricing) * 100 : 0
      },
      featureComparison: this.compareFeatures(planTier, userAnalytics),
      migrationComplexity: this.assessMigrationComplexity(planTier, userAnalytics),
      timeline: {
        immediateAction: this.requiresImmediateAction(userAnalytics),
        urgencyIndicators: this.getUrgencyIndicators(userAnalytics)
      },
      discounts: userAnalytics.migrationEligibility.discounts.filter(d => 
        d.eligiblePlans.includes(planTier) || d.eligiblePlans.length === 0
      ),
      preservedBenefits: userAnalytics.migrationEligibility.preservedBenefits
    };
  }

  /**
   * Calculate match reasons and scores for a plan
   */
  private static calculateMatchReasons(planTier: PlanTier, userAnalytics: UserAnalytics): MatchReason[] {
    const reasons: MatchReason[] = [];
    const userCount = userAnalytics.usageMetrics.totalUsers;
    const planLimits = this.PLAN_PRICING[planTier];

    // User count compatibility
    const userCountScore = this.scoreUserCountMatch(userCount, planTier);
    reasons.push({
      factor: MatchFactor.USER_COUNT,
      weight: this.PLAN_WEIGHTS[MatchFactor.USER_COUNT],
      score: userCountScore,
      explanation: this.explainUserCountMatch(userCount, planTier, userCountScore)
    });

    // Feature requirements
    const featureScore = this.scoreFeatureMatch(planTier, userAnalytics);
    reasons.push({
      factor: MatchFactor.FEATURE_REQUIREMENTS,
      weight: this.PLAN_WEIGHTS[MatchFactor.FEATURE_REQUIREMENTS], 
      score: featureScore,
      explanation: this.explainFeatureMatch(planTier, featureScore)
    });

    // Budget alignment
    const budgetScore = this.scoreBudgetAlignment(planTier, userAnalytics);
    reasons.push({
      factor: MatchFactor.BUDGET_ALIGNMENT,
      weight: this.PLAN_WEIGHTS[MatchFactor.BUDGET_ALIGNMENT],
      score: budgetScore,
      explanation: this.explainBudgetAlignment(planTier, budgetScore)
    });

    // Usage patterns
    const usageScore = this.scoreUsagePatterns(planTier, userAnalytics);
    reasons.push({
      factor: MatchFactor.USAGE_PATTERNS,
      weight: this.PLAN_WEIGHTS[MatchFactor.USAGE_PATTERNS],
      score: usageScore,
      explanation: this.explainUsagePatterns(planTier, usageScore)
    });

    // Growth trajectory
    const growthScore = this.scoreGrowthAlignment(planTier, userAnalytics);
    reasons.push({
      factor: MatchFactor.GROWTH_TRAJECTORY,
      weight: this.PLAN_WEIGHTS[MatchFactor.GROWTH_TRAJECTORY],
      score: growthScore,
      explanation: this.explainGrowthAlignment(planTier, growthScore)
    });

    return reasons;
  }

  /**
   * Helper methods for scoring different factors
   */
  private static scoreUserCountMatch(userCount: number, planTier: PlanTier): number {
    const planLimits = this.PLAN_PRICING[planTier];
    const maxUsers = planLimits.maxUsers || 0;
    
    if (planTier === PlanTier.ENTERPRISE) {
      return userCount > 50 ? 100 : 70;
    }
    
    if (planTier === PlanTier.FREE) {
      return userCount <= maxUsers ? 100 : 0;
    }
    
    if (userCount <= maxUsers) {
      return userCount >= maxUsers * 0.7 ? 100 : 80;
    }
    
    return Math.max(0, 100 - ((userCount - maxUsers) * 10));
  }

  private static scoreFeatureMatch(planTier: PlanTier, userAnalytics: UserAnalytics): number {
    const utilization = userAnalytics.usageMetrics.featureUtilization;
    let score = 60; // Base score

    // Advanced features (Business and Enterprise plans)
    if ([PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE].includes(planTier)) {
      if (utilization.reporting > 0.5) score += 10;
      if (utilization.advancedPermissions > 0.3) score += 10;
      if (utilization.clientPortal > 0.2) score += 10;
      if (utilization.resourceManagement > 0.4) score += 10;
    }

    // Core features (Pro and above)
    if (planTier !== PlanTier.FREE) {
      if (utilization.ganttCharts > 0.3) score += 5;
      if (utilization.timeTracking > 0.4) score += 5;
      if (utilization.customFields > 0.3) score += 5;
    }

    return Math.min(100, score);
  }

  private static scoreBudgetAlignment(planTier: PlanTier, userAnalytics: UserAnalytics): number {
    if (userAnalytics.userType === UserType.FREE && planTier === PlanTier.FREE) return 100;
    if (userAnalytics.userType === UserType.TRIAL) return planTier === PlanTier.PRO_SMALL ? 90 : 70;
    
    // For custom plan users, prefer similar or better value
    if (userAnalytics.customPlanDetails) {
      const currentCost = userAnalytics.customPlanDetails.currentPricing;
      const newCost = this.calculatePlanCost(planTier, userAnalytics.usageMetrics.totalUsers);
      
      if (newCost <= currentCost * 1.1) return 90; // Within 10% increase
      if (newCost <= currentCost * 1.3) return 70; // Within 30% increase
      return 50;
    }

    return 75; // Default score
  }

  private static scoreUsagePatterns(planTier: PlanTier, userAnalytics: UserAnalytics): number {
    const metrics = userAnalytics.usageMetrics;
    let score = 60;

    // High collaboration teams benefit from larger plans
    if (metrics.teamCollaborationIndex > 0.7 && [PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE].includes(planTier)) {
      score += 20;
    }

    // High project complexity benefits from advanced features
    if (metrics.averageProjectComplexity > 0.6 && [PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE].includes(planTier)) {
      score += 15;
    }

    return Math.min(100, score);
  }

  private static scoreGrowthAlignment(planTier: PlanTier, userAnalytics: UserAnalytics): number {
    const growth = userAnalytics.usageMetrics.growthTrend;
    const predicted6Month = growth.predicted6MonthUsers;
    
    const planLimits = this.PLAN_PRICING[planTier];
    
    if (planTier === PlanTier.ENTERPRISE) {
      return predicted6Month > 50 ? 100 : 60;
    }
    
    const maxUsers = planLimits.maxUsers || 0;
    if (predicted6Month <= maxUsers * 0.8) {
      return 100; // Good room for growth
    } else if (predicted6Month <= maxUsers) {
      return 80; // Will fit but tight
    } else {
      return Math.max(30, 100 - ((predicted6Month - maxUsers) * 5));
    }
  }

  /**
   * Helper methods for explanations
   */
  private static explainUserCountMatch(userCount: number, planTier: PlanTier, score: number): string {
    const planLimits = this.PLAN_PRICING[planTier];
    
    if (score >= 90) {
      return `Perfect fit: Your ${userCount} users are well within the ${planLimits.maxUsers === -1 ? 'unlimited' : planLimits.maxUsers} user limit`;
    } else if (score >= 70) {
      return `Good fit: Accommodates your ${userCount} users with room for growth`;
    } else {
      return `Capacity concern: ${userCount} users may exceed optimal capacity for this plan`;
    }
  }

  private static explainFeatureMatch(planTier: PlanTier, score: number): string {
    if (score >= 90) {
      return "Excellent feature alignment with your usage patterns";
    } else if (score >= 70) {
      return "Good feature coverage for your team's needs";
    } else {
      return "Basic features may limit your team's productivity";
    }
  }

  private static explainBudgetAlignment(planTier: PlanTier, score: number): string {
    if (score >= 90) {
      return "Excellent value proposition for your organization";
    } else if (score >= 70) {
      return "Reasonable cost for the features provided";
    } else {
      return "Higher cost may require budget consideration";
    }
  }

  private static explainUsagePatterns(planTier: PlanTier, score: number): string {
    if (score >= 80) {
      return "Plan features align well with your team's workflow";
    } else {
      return "Standard features for typical usage patterns";
    }
  }

  private static explainGrowthAlignment(planTier: PlanTier, score: number): string {
    if (score >= 90) {
      return "Excellent scalability for your projected growth";
    } else if (score >= 70) {
      return "Adequate capacity for expected team expansion";
    } else {
      return "May need plan upgrade as team grows";
    }
  }

  /**
   * Calculate overall recommendation score
   */
  private static calculateRecommendationScore(matchReasons: MatchReason[]): number {
    return Math.round(
      matchReasons.reduce((total, reason) => total + (reason.score * reason.weight), 0)
    );
  }

  /**
   * Calculate confidence level
   */
  private static calculateConfidenceLevel(matchReasons: MatchReason[], userAnalytics: UserAnalytics): number {
    const scoreVariance = this.calculateScoreVariance(matchReasons);
    const dataQuality = this.assessDataQuality(userAnalytics);
    
    // Higher confidence with lower variance and better data quality
    return Math.round(Math.max(60, 100 - scoreVariance - (100 - dataQuality)));
  }

  private static calculateScoreVariance(matchReasons: MatchReason[]): number {
    const scores = matchReasons.map(r => r.score);
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
  }

  private static assessDataQuality(userAnalytics: UserAnalytics): number {
    let quality = 70; // Base quality
    
    if (userAnalytics.usageMetrics.totalUsers > 0) quality += 10;
    if (userAnalytics.usageMetrics.totalProjects > 0) quality += 10;
    if (userAnalytics.customPlanDetails) quality += 10;
    
    return Math.min(100, quality);
  }

  /**
   * Utility methods
   */
  private static getEligiblePlans(userType: string): string[] {
    switch (userType) {
      case UserType.TRIAL:
      case UserType.FREE:
        return [PlanTier.PRO_SMALL, PlanTier.BUSINESS_SMALL, PlanTier.PRO_LARGE, PlanTier.BUSINESS_LARGE];
      case UserType.APPSUMO:
        return [PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE];
      case UserType.CUSTOM_PLAN:
        return [PlanTier.PRO_SMALL, PlanTier.BUSINESS_SMALL, PlanTier.PRO_LARGE, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE];
      default:
        return [PlanTier.PRO_SMALL, PlanTier.BUSINESS_SMALL];
    }
  }

  private static getEligiblePlansForUserType(userType: UserType, appSumoStatus?: AppSumoStatus): PlanTier[] {
    if (userType === UserType.APPSUMO && appSumoStatus) {
      // AppSumo users must choose Business plans or higher
      return [PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE];
    }
    
    if (userType === UserType.TRIAL || userType === UserType.FREE) {
      // Show all paid plans to trial/free users
      return [PlanTier.PRO_SMALL, PlanTier.BUSINESS_SMALL, PlanTier.PRO_LARGE, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE];
    }
    
    // Default: all plans except free
    return [PlanTier.PRO_SMALL, PlanTier.BUSINESS_SMALL, PlanTier.PRO_LARGE, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE];
  }

  private static async getAvailableDiscounts(userType: string, organizationId: string): Promise<MigrationDiscount[]> {
    const discounts: MigrationDiscount[] = [];
    
    // User type specific discounts
    switch (userType) {
      case UserType.TRIAL:
        discounts.push({
          code: 'TRIAL_CONVERT_20',
          type: DiscountType.PERCENTAGE,
          value: 20,
          duration: 3,
          conditions: ['First-time conversion from trial'],
          eligiblePlans: [],
          stackable: false
        });
        break;
      case UserType.FREE:
        discounts.push({
          code: 'FREE_UPGRADE_10',
          type: DiscountType.PERCENTAGE,
          value: 10,
          duration: 1,
          conditions: ['Upgrade from free plan'],
          eligiblePlans: [],
          stackable: false
        });
        break;
      case UserType.CUSTOM_PLAN:
        discounts.push({
          code: 'LOYALTY_25',
          type: DiscountType.PERCENTAGE,
          value: 25,
          duration: 12,
          conditions: ['Loyalty discount for existing custom plan users'],
          eligiblePlans: [],
          stackable: true
        });
        break;
      case UserType.APPSUMO:
        discounts.push({
          code: 'APPSUMO_50',
          type: DiscountType.PERCENTAGE,
          value: 50,
          duration: 12,
          conditions: ['AppSumo user special offer', '5-day migration window'],
          eligiblePlans: [PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE],
          stackable: false
        });
        break;
    }

    return discounts;
  }

  private static generateUpgradeReasons(userType: string): UpgradeReason[] {
    const reasons: UpgradeReason[] = [];
    
    switch (userType) {
      case UserType.TRIAL:
        reasons.push({
          reason: 'Trial period ending soon',
          priority: 'high',
          impact: 'Access to your projects will be limited',
          category: UpgradeCategory.CAPACITY
        });
        break;
      case UserType.FREE:
        reasons.push({
          reason: 'Limited user capacity (3 users)',
          priority: 'medium',
          impact: 'Cannot add more team members',
          category: UpgradeCategory.CAPACITY
        });
        break;
      case UserType.CUSTOM_PLAN:
        reasons.push({
          reason: 'Migration to standardized pricing',
          priority: 'medium',
          impact: 'Access to new features and better support',
          category: UpgradeCategory.FEATURES
        });
        break;
      case UserType.APPSUMO:
        reasons.push({
          reason: 'Limited-time migration window',
          priority: 'critical',
          impact: 'Special pricing expires in 5 days',
          category: UpgradeCategory.COST_OPTIMIZATION
        });
        break;
    }

    return reasons;
  }

  private static compareFeatures(planTier: PlanTier, userAnalytics: UserAnalytics): any {
    // Simplified feature comparison
    const currentFeatures = userAnalytics.customPlanDetails?.currentFeatures;
    const newFeatures = this.getPlanFeatures(planTier);
    
    return {
      currentFeatures: currentFeatures ? Object.keys(currentFeatures).filter(k => currentFeatures[k as keyof typeof currentFeatures]) : [],
      newFeatures: Object.keys(newFeatures).filter(k => newFeatures[k as keyof typeof newFeatures]),
      upgradedFeatures: [],
      removedFeatures: [],
      featureMatchPercent: 85, // Calculated percentage
      criticalFeaturesMet: true
    };
  }

  private static getPlanFeatures(planTier: PlanTier): any {
    // Return feature set for each plan tier
    const baseFeatures = {
      projects: true,
      tasks: true,
      basicReporting: true
    };

    switch (planTier) {
      case PlanTier.FREE:
        return baseFeatures;
      case PlanTier.PRO_SMALL:
      case PlanTier.PRO_LARGE:
        return { ...baseFeatures, ganttCharts: true, timeTracking: true, customFields: true };
      case PlanTier.BUSINESS_SMALL:
      case PlanTier.BUSINESS_LARGE:
        return { 
          ...baseFeatures, 
          ganttCharts: true, 
          timeTracking: true, 
          customFields: true,
          advancedReporting: true,
          clientPortal: true,
          resourceManagement: true
        };
      case PlanTier.ENTERPRISE:
        return {
          ...baseFeatures,
          ganttCharts: true,
          timeTracking: true,
          customFields: true,
          advancedReporting: true,
          clientPortal: true,
          resourceManagement: true,
          advancedPermissions: true,
          sso: true,
          prioritySupport: true
        };
      default:
        return baseFeatures;
    }
  }

  private static assessMigrationComplexity(planTier: PlanTier, userAnalytics: UserAnalytics): 'simple' | 'moderate' | 'complex' {
    if (userAnalytics.userType === UserType.FREE || userAnalytics.userType === UserType.TRIAL) {
      return 'simple';
    }
    
    if (userAnalytics.customPlanDetails) {
      return 'complex';
    }
    
    return 'moderate';
  }

  private static requiresImmediateAction(userAnalytics: UserAnalytics): boolean {
    if (userAnalytics.appSumoStatus?.remainingMigrationDays && userAnalytics.appSumoStatus.remainingMigrationDays <= 5) {
      return true;
    }
    
    // Add other immediate action criteria
    return false;
  }

  private static getUrgencyIndicators(userAnalytics: UserAnalytics): string[] {
    const indicators: string[] = [];
    
    if (userAnalytics.appSumoStatus?.remainingMigrationDays) {
      indicators.push(`AppSumo migration window expires in ${userAnalytics.appSumoStatus.remainingMigrationDays} days`);
    }
    
    if (userAnalytics.usageMetrics.totalUsers >= 3 && userAnalytics.userType === UserType.FREE) {
      indicators.push('At user limit - upgrade needed to add team members');
    }
    
    return indicators;
  }

  private static getPlanDisplayName(planTier: PlanTier): string {
    switch (planTier) {
      case PlanTier.FREE: return 'Free Plan';
      case PlanTier.PRO_SMALL: return 'Pro Small';
      case PlanTier.BUSINESS_SMALL: return 'Business Small';
      case PlanTier.PRO_LARGE: return 'Pro Large';
      case PlanTier.BUSINESS_LARGE: return 'Business Large';
      case PlanTier.ENTERPRISE: return 'Enterprise';
      default: return planTier;
    }
  }

  private static calculatePlanCost(planTier: PlanTier, userCount: number): number {
    const pricing = this.PLAN_PRICING[planTier];
    
    if (planTier === PlanTier.FREE) return 0;
    if (planTier === PlanTier.ENTERPRISE) return pricing.monthly;
    
    if (planTier === PlanTier.PRO_LARGE || planTier === PlanTier.BUSINESS_LARGE) {
      const baseUsers = pricing.baseUsers || 0;
      const extraUsers = Math.max(0, userCount - baseUsers);
      return pricing.monthly + (extraUsers * (pricing.extraUserCost || 0));
    }
    
    return pricing.monthly * userCount;
  }

  /**
   * Identify urgent actions needed
   */
  private static async identifyUrgentActions(userAnalytics: UserAnalytics): Promise<UrgentAction[]> {
    const actions: UrgentAction[] = [];
    
    // AppSumo migration deadline
    if (userAnalytics.appSumoStatus?.remainingMigrationDays && userAnalytics.appSumoStatus.remainingMigrationDays <= 5) {
      actions.push({
        type: 'migration_deadline',
        message: `AppSumo migration window expires in ${userAnalytics.appSumoStatus.remainingMigrationDays} days`,
        deadline: new Date(Date.now() + userAnalytics.appSumoStatus.remainingMigrationDays * 24 * 60 * 60 * 1000),
        severity: userAnalytics.appSumoStatus.remainingMigrationDays <= 2 ? 'critical' : 'error',
        actionRequired: 'Choose and migrate to a Business plan to retain 50% discount'
      });
    }
    
    // User limit reached
    if (userAnalytics.usageMetrics.totalUsers >= 3 && userAnalytics.userType === UserType.FREE) {
      actions.push({
        type: 'capacity_limit',
        message: 'Free plan user limit reached (3/3 users)',
        severity: 'warning',
        actionRequired: 'Upgrade to add more team members'
      });
    }
    
    return actions;
  }

  /**
   * Generate migration summary
   */
  private static async generateMigrationSummary(userAnalytics: UserAnalytics, recommendations: PlanRecommendation[]): Promise<MigrationSummary> {
    const topRecommendation = recommendations[0];
    
    let recommendedAction: 'migrate_now' | 'plan_migration' | 'stay_current' | 'evaluate_options' = 'evaluate_options';
    
    if (userAnalytics.appSumoStatus?.remainingMigrationDays && userAnalytics.appSumoStatus.remainingMigrationDays <= 5) {
      recommendedAction = 'migrate_now';
    } else if (topRecommendation?.recommendationScore > 80) {
      recommendedAction = 'plan_migration';
    } else if (userAnalytics.userType === UserType.CUSTOM_PLAN) {
      recommendedAction = 'stay_current';
    }
    
    return {
      eligibleForMigration: userAnalytics.migrationEligibility.isEligible,
      recommendedAction,
      timeline: this.getTimelineRecommendation(userAnalytics),
      estimatedSavings: this.calculateEstimatedSavings(userAnalytics, topRecommendation),
      riskFactors: this.identifyRiskFactors(userAnalytics)
    };
  }

  private static getTimelineRecommendation(userAnalytics: UserAnalytics): string {
    if (userAnalytics.appSumoStatus?.remainingMigrationDays) {
      return `Immediate action required - ${userAnalytics.appSumoStatus.remainingMigrationDays} days remaining`;
    }
    
    if (userAnalytics.userType === UserType.TRIAL) {
      return 'Within 7 days before trial expires';
    }
    
    return 'Flexible timeline - migrate when convenient';
  }

  private static calculateEstimatedSavings(userAnalytics: UserAnalytics, recommendation?: PlanRecommendation): number | undefined {
    if (!recommendation || !userAnalytics.customPlanDetails) return undefined;
    
    const currentCost = userAnalytics.customPlanDetails.currentPricing;
    const newCostWithDiscount = recommendation.costAnalysis.newPlanCost; // No discount for now
    
    if (newCostWithDiscount < currentCost) {
      return (currentCost - newCostWithDiscount) * 12; // Annual savings
    }
    
    return undefined;
  }

  private static identifyRiskFactors(userAnalytics: UserAnalytics): string[] {
    const risks: string[] = [];
    
    if (userAnalytics.customPlanDetails) {
      risks.push('Loss of grandfathered pricing');
      risks.push('Potential feature differences');
    }
    
    if (userAnalytics.usageMetrics.storageUsed > 50 * 1024 * 1024 * 1024) { // 50GB
      risks.push('Large data migration required');
    }
    
    if (userAnalytics.usageMetrics.totalUsers > 20) {
      risks.push('Complex user permission migration');
    }
    
    return risks;
  }

  /**
   * Get special offers
   */
  private static async getSpecialOffers(userAnalytics: UserAnalytics): Promise<SpecialOffer[]> {
    const offers: SpecialOffer[] = [];
    
    // AppSumo special offer
    if (userAnalytics.appSumoStatus?.eligibleForSpecialDiscount) {
      offers.push({
        id: 'appsumo-50off',
        title: 'AppSumo Exclusive: 50% Off Business Plans',
        description: 'Limited time offer for AppSumo customers. Get 50% off any Business plan for 12 months.',
        discount: {
          code: 'APPSUMO_50',
          type: DiscountType.PERCENTAGE,
          value: 50,
          duration: 12,
          conditions: ['AppSumo customer', 'Business plan or higher'],
          eligiblePlans: [PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE],
          stackable: false
        },
        validUntil: new Date(Date.now() + (userAnalytics.appSumoStatus.remainingMigrationDays || 5) * 24 * 60 * 60 * 1000),
        eligibilityRequirements: ['AppSumo customer', 'Migration within 5 days'],
        featured: true
      });
    }
    
    // Trial conversion offer - no discount for now
    if (userAnalytics.userType === UserType.TRIAL) {
      offers.push({
        id: 'trial-convert',
        title: 'Trial Conversion',
        description: 'Convert from trial to any paid plan at standard pricing.',
        discount: {
          code: 'TRIAL_CONVERT',
          type: DiscountType.PERCENTAGE,
          value: 0,
          duration: 0,
          conditions: ['Trial to paid conversion'],
          eligiblePlans: [],
          stackable: false
        },
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        eligibilityRequirements: ['Active trial user'],
        featured: false
      });
    }
    
    return offers;
  }
}