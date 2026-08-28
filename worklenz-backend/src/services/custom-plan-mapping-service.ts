import db from "../config/db";
import { log_error } from "../shared/utils";
import {
  CustomPlanDetails,
  PlanEquivalency,
  LegacyPlanFeatures,
  PlanTier,
  CostComparison,
  MigrationDiscount,
  DiscountType,
  PlanPricing
} from "../interfaces/plan-recommendation";

export class CustomPlanMappingService {
  
  private static readonly PLAN_FEATURES = {
    [PlanTier.FREE]: {
      unlimitedProjects: false,
      storageLimit: 5, // GB
      customFields: false,
      ganttCharts: false,
      timeTracking: false,
      reporting: false,
      integrations: false,
      clientPortal: false,
      advancedPermissions: false,
      priority: 'basic' as const,
      userLimit: 3,
      supportLevel: 'community'
    },
    [PlanTier.PRO_SMALL]: {
      unlimitedProjects: true,
      storageLimit: 100,
      customFields: true,
      ganttCharts: true,
      timeTracking: true,
      reporting: true,
      integrations: true,
      clientPortal: false,
      advancedPermissions: false,
      priority: 'standard' as const,
      userLimit: 5,
      supportLevel: 'email'
    },
    [PlanTier.BUSINESS_SMALL]: {
      unlimitedProjects: true,
      storageLimit: 500,
      customFields: true,
      ganttCharts: true,
      timeTracking: true,
      reporting: true,
      integrations: true,
      clientPortal: true,
      advancedPermissions: true,
      priority: 'premium' as const,
      userLimit: 5,
      supportLevel: 'priority'
    },
    [PlanTier.PRO_LARGE]: {
      unlimitedProjects: true,
      storageLimit: 1000,
      customFields: true,
      ganttCharts: true,
      timeTracking: true,
      reporting: true,
      integrations: true,
      clientPortal: false,
      advancedPermissions: false,
      priority: 'standard' as const,
      userLimit: 50,
      supportLevel: 'email'
    },
    [PlanTier.BUSINESS_LARGE]: {
      unlimitedProjects: true,
      storageLimit: 2000,
      customFields: true,
      ganttCharts: true,
      timeTracking: true,
      reporting: true,
      integrations: true,
      clientPortal: true,
      advancedPermissions: true,
      priority: 'premium' as const,
      userLimit: 100,
      supportLevel: 'priority'
    },
    [PlanTier.ENTERPRISE]: {
      unlimitedProjects: true,
      storageLimit: -1, // Unlimited
      customFields: true,
      ganttCharts: true,
      timeTracking: true,
      reporting: true,
      integrations: true,
      clientPortal: true,
      advancedPermissions: true,
      priority: 'enterprise' as const,
      userLimit: -1, // Unlimited
      supportLevel: 'dedicated'
    }
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
   * Get custom plan details and generate mappings to new plans
   */
  public static async getCustomPlanMappings(organizationId: string): Promise<CustomPlanDetails | null> {
    try {
      const customPlanData = await this.getCustomPlanData(organizationId);
      
      if (!customPlanData) {
        return null; // Not a custom plan user
      }

      const currentFeatures = this.parseCustomPlanFeatures(customPlanData);
      const equivalentNewPlans = await this.findEquivalentPlans(customPlanData, organizationId);
      const grandfatheredBenefits = this.identifyGrandfatheredBenefits(customPlanData);

      return {
        currentFeatures,
        currentPricing: customPlanData.monthly_price || 0,
        grandfatheredBenefits,
        preservationEligible: customPlanData.preserve_pricing || false,
        equivalentNewPlans
      };

    } catch (error) {
      log_error(error);
      throw new Error("Failed to get custom plan mappings");
    }
  }

  /**
   * Get custom plan data from database
   */
  private static async getCustomPlanData(organizationId: string): Promise<any> {
    const query = `
      SELECT 
        lcs.id as custom_plan_id,
        lcs.plan_name,
        lcs.monthly_price,
        lcs.user_limit,
        lcs.features,
        lcs.billing_cycle,
        lcs.created_at,
        lcpm.new_plan_tier,
        lcpm.feature_match_percentage,
        lcpm.preserve_pricing,
        lcpm.grandfathered_benefits,
        o.user_id
      FROM organizations o
      JOIN licensing_custom_subs lcs ON lcs.user_id = o.user_id
      LEFT JOIN licensing_custom_plan_mappings lcpm ON lcpm.custom_plan_id = lcs.id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [organizationId]);
    return result.rows[0] || null;
  }

  /**
   * Parse custom plan features from stored data
   */
  private static parseCustomPlanFeatures(customPlanData: any): LegacyPlanFeatures {
    const features = typeof customPlanData.features === 'string' 
      ? JSON.parse(customPlanData.features) 
      : customPlanData.features || {};

    return {
      unlimitedProjects: features.unlimited_projects ?? true,
      storageLimit: features.storage_limit ?? 100,
      customFields: features.custom_fields ?? false,
      ganttCharts: features.gantt_charts ?? false,
      timeTracking: features.time_tracking ?? false,
      reporting: features.reporting ?? false,
      integrations: features.integrations ?? false,
      clientPortal: features.client_portal ?? false,
      advancedPermissions: features.advanced_permissions ?? false,
      priority: features.priority ?? 'standard'
    };
  }

  /**
   * Find equivalent new plans based on features and usage
   */
  private static async findEquivalentPlans(customPlanData: any, organizationId: string): Promise<PlanEquivalency[]> {
    const currentFeatures = this.parseCustomPlanFeatures(customPlanData);
    const userCount = await this.getCurrentUserCount(organizationId);
    const currentPrice = customPlanData.monthly_price || 0;

    const equivalencies: PlanEquivalency[] = [];

    // Check each new plan tier
    for (const [planTier, planFeatures] of Object.entries(this.PLAN_FEATURES)) {
      if (planTier === PlanTier.FREE) continue; // Skip free plan
      
      const tier = planTier as PlanTier;
      const featureMatchPercent = this.calculateFeatureMatch(currentFeatures, planFeatures);
      const costComparison = this.calculateCostComparison(tier, userCount, currentPrice);
      const migrationComplexity = this.assessMigrationComplexity(featureMatchPercent, costComparison);
      const recommendationScore = this.calculateRecommendationScore(
        featureMatchPercent, 
        costComparison, 
        migrationComplexity,
        tier,
        userCount
      );

      // Only include plans that meet minimum feature requirements
      if (featureMatchPercent >= 70) {
        equivalencies.push({
          newPlanId: tier,
          featureMatchPercent,
          costComparison,
          migrationComplexity,
          recommendationScore
        });
      }
    }

    // Sort by recommendation score
    return equivalencies.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Calculate feature match percentage between current and new plan
   */
  private static calculateFeatureMatch(currentFeatures: LegacyPlanFeatures, newPlanFeatures: any): number {
    const featureWeights = {
      unlimitedProjects: 15,
      storageLimit: 10,
      customFields: 15,
      ganttCharts: 15,
      timeTracking: 15,
      reporting: 10,
      integrations: 10,
      clientPortal: 10,
      advancedPermissions: 10,
      priority: 5,
      userLimit: 20,
      supportLevel: 5
    };

    let totalWeight = 0;
    let matchedWeight = 0;

    // Check each feature
    for (const [feature, weight] of Object.entries(featureWeights)) {
      totalWeight += weight;

      switch (feature) {
        case 'unlimitedProjects':
          if (currentFeatures.unlimitedProjects === newPlanFeatures.unlimitedProjects) {
            matchedWeight += weight;
          } else if (!currentFeatures.unlimitedProjects && newPlanFeatures.unlimitedProjects) {
            matchedWeight += weight; // Upgrade is good
          }
          break;

        case 'storageLimit':
          if (newPlanFeatures.storageLimit === -1 || newPlanFeatures.storageLimit >= currentFeatures.storageLimit) {
            matchedWeight += weight;
          } else {
            // Partial credit if new plan has at least 80% of current storage
            const ratio = newPlanFeatures.storageLimit / currentFeatures.storageLimit;
            if (ratio >= 0.8) matchedWeight += weight * ratio;
          }
          break;

        case 'userLimit':
          // This will be handled separately based on actual user count
          matchedWeight += weight; // Full credit for now
          break;

        case 'priority':
          const priorityScore = this.comparePriority(currentFeatures.priority, newPlanFeatures.priority);
          matchedWeight += weight * priorityScore;
          break;

        default:
          // Boolean features
          if (feature in currentFeatures && feature in newPlanFeatures) {
            const currentValue = currentFeatures[feature as keyof LegacyPlanFeatures];
            const newValue = newPlanFeatures[feature];
            
            if (currentValue === newValue) {
              matchedWeight += weight;
            } else if (!currentValue && newValue) {
              matchedWeight += weight; // Upgrade is good
            }
          }
          break;
      }
    }

    return Math.round((matchedWeight / totalWeight) * 100);
  }

  /**
   * Compare priority levels
   */
  private static comparePriority(current: string, newPriority: string): number {
    const priorityLevels = {
      'basic': 1,
      'standard': 2,
      'premium': 3,
      'enterprise': 4
    };

    const currentLevel = priorityLevels[current as keyof typeof priorityLevels] || 2;
    const newLevel = priorityLevels[newPriority as keyof typeof priorityLevels] || 2;

    if (newLevel >= currentLevel) return 1; // Same or better priority
    return Math.max(0.5, newLevel / currentLevel); // Reduced credit for lower priority
  }

  /**
   * Calculate cost comparison
   */
  private static calculateCostComparison(planTier: PlanTier, userCount: number, currentPrice: number): CostComparison {
    const pricing = this.PLAN_PRICING[planTier];
    let newPlanCost = pricing.monthly;

    // Calculate cost based on plan structure
    if (planTier === PlanTier.PRO_LARGE || planTier === PlanTier.BUSINESS_LARGE) {
      const baseUsers = pricing.baseUsers || 0;
      const extraUsers = Math.max(0, userCount - baseUsers);
      newPlanCost = pricing.monthly + (extraUsers * (pricing.extraUserCost || 0));
    } else if (planTier !== PlanTier.ENTERPRISE) {
      newPlanCost = pricing.monthly * userCount;
    }

    const differenceAmount = newPlanCost - currentPrice;
    const differencePercent = currentPrice > 0 ? (differenceAmount / currentPrice) * 100 : 0;

    // Calculate with potential grandfathered discount (preserves existing pricing only)
    const withDiscountCost = newPlanCost;

    return {
      currentCost: currentPrice,
      newPlanCost,
      differenceAmount,
      differencePercent,
      withDiscountCost,
      breakEvenMonths: differenceAmount > 0 ? Math.ceil(differenceAmount / (currentPrice / 12)) : undefined
    };
  }

  /**
   * Assess migration complexity
   */
  private static assessMigrationComplexity(featureMatchPercent: number, costComparison: CostComparison): 'simple' | 'moderate' | 'complex' {
    if (featureMatchPercent >= 95 && Math.abs(costComparison.differencePercent) <= 10) {
      return 'simple';
    }
    
    if (featureMatchPercent >= 85 && Math.abs(costComparison.differencePercent) <= 30) {
      return 'moderate';
    }
    
    return 'complex';
  }

  /**
   * Calculate recommendation score
   */
  private static calculateRecommendationScore(
    featureMatchPercent: number,
    costComparison: CostComparison,
    migrationComplexity: 'simple' | 'moderate' | 'complex',
    planTier: PlanTier,
    userCount: number
  ): number {
    let score = 0;

    // Feature match weight (40%)
    score += featureMatchPercent * 0.4;

    // Cost consideration weight (30%)
    const costScore = this.calculateCostScore(costComparison);
    score += costScore * 0.3;

    // Migration complexity weight (20%)
    const complexityScore = migrationComplexity === 'simple' ? 100 : 
                           migrationComplexity === 'moderate' ? 70 : 40;
    score += complexityScore * 0.2;

    // Plan fit weight (10%)
    const planFitScore = this.calculatePlanFitScore(planTier, userCount);
    score += planFitScore * 0.1;

    return Math.round(score);
  }

  /**
   * Calculate cost score (higher is better)
   */
  private static calculateCostScore(costComparison: CostComparison): number {
    const diffPercent = Math.abs(costComparison.differencePercent);
    
    if (diffPercent <= 5) return 100; // Minimal cost difference
    if (diffPercent <= 15) return 80;  // Reasonable difference
    if (diffPercent <= 30) return 60;  // Moderate difference
    if (diffPercent <= 50) return 40;  // Significant difference
    return 20; // Large difference
  }

  /**
   * Calculate plan fit score based on user count and plan limits
   */
  private static calculatePlanFitScore(planTier: PlanTier, userCount: number): number {
    const planFeatures = this.PLAN_FEATURES[planTier];
    const userLimit = planFeatures.userLimit;

    if (userLimit === -1) return 90; // Unlimited is always good fit

    if (userCount <= userLimit * 0.6) return 100; // Plenty of room
    if (userCount <= userLimit * 0.8) return 90;  // Good fit
    if (userCount <= userLimit) return 70;        // Tight fit
    return 30; // Over limit
  }

  /**
   * Get current user count for organization
   */
  private static async getCurrentUserCount(organizationId: string): Promise<number> {
    const query = `
      SELECT COUNT(DISTINCT tm.email) as user_count
      FROM organizations o
      JOIN teams t ON t.user_id = o.user_id
      LEFT JOIN team_members tm ON tm.team_id = t.id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [organizationId]);
    return Number(result.rows[0]?.user_count) || 1;
  }

  /**
   * Identify grandfathered benefits
   */
  private static identifyGrandfatheredBenefits(customPlanData: any): string[] {
    const benefits: string[] = [];

    if (customPlanData.monthly_price) {
      benefits.push(`Grandfathered pricing: $${customPlanData.monthly_price}/month`);
    }

    const features = this.parseCustomPlanFeatures(customPlanData);
    
    if (features.unlimitedProjects) {
      benefits.push("Unlimited projects access");
    }
    
    if (features.storageLimit > 100) {
      benefits.push(`Enhanced storage: ${features.storageLimit}GB`);
    }

    if (customPlanData.user_limit > 20) {
      benefits.push(`Extended user limit: ${customPlanData.user_limit} users`);
    }

    benefits.push("Legacy feature configuration");
    benefits.push("Existing plan terms and conditions");

    return benefits;
  }

  /**
   * Create or update custom plan mapping
   */
  public static async createCustomPlanMapping(
    organizationId: string,
    recommendedPlan: PlanTier,
    preservePricing: boolean = true
  ): Promise<{
    success: boolean;
    mappingId?: string;
    message: string;
  }> {
    try {
      // Get custom plan data
      const customPlanData = await this.getCustomPlanData(organizationId);
      
      if (!customPlanData) {
        throw new Error("No custom plan found for organization");
      }

      // Calculate feature match
      const currentFeatures = this.parseCustomPlanFeatures(customPlanData);
      const newPlanFeatures = this.PLAN_FEATURES[recommendedPlan];
      const featureMatchPercent = this.calculateFeatureMatch(currentFeatures, newPlanFeatures);

      // Create or update mapping
      const mappingQuery = `
        INSERT INTO licensing_custom_plan_mappings (
          custom_plan_id,
          organization_id,
          new_plan_tier,
          feature_match_percentage,
          preserve_pricing,
          grandfathered_benefits,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (custom_plan_id) 
        DO UPDATE SET 
          new_plan_tier = $3,
          feature_match_percentage = $4,
          preserve_pricing = $5,
          grandfathered_benefits = $6,
          updated_at = NOW()
        RETURNING id
      `;

      const grandfatheredBenefits = this.identifyGrandfatheredBenefits(customPlanData);

      const result = await db.query(mappingQuery, [
        customPlanData.custom_plan_id,
        organizationId,
        recommendedPlan,
        featureMatchPercent,
        preservePricing,
        JSON.stringify(grandfatheredBenefits)
      ]);

      return {
        success: true,
        mappingId: result.rows[0].id,
        message: "Custom plan mapping created successfully"
      };

    } catch (error) {
      log_error(error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create custom plan mapping"
      };
    }
  }

  /**
   * Generate grandfathered pricing discount
   */
  public static async generateGrandfatheredDiscount(organizationId: string, targetPlan: PlanTier): Promise<MigrationDiscount | null> {
    try {
      const customPlanData = await this.getCustomPlanData(organizationId);
      
      if (!customPlanData || !customPlanData.preserve_pricing) {
        return null;
      }

      const userCount = await this.getCurrentUserCount(organizationId);
      const currentPrice = customPlanData.monthly_price;
      const newPlanCost = this.calculateNewPlanCost(targetPlan, userCount);

      if (currentPrice >= newPlanCost) {
        return null; // No discount needed
      }

      // Calculate discount needed to preserve pricing
      const discountAmount = newPlanCost - currentPrice;
      const discountPercent = Math.round((discountAmount / newPlanCost) * 100);

      return {
        code: `GRANDFATHERED_${organizationId}_${Date.now()}`,
        type: DiscountType.PERCENTAGE,
        value: discountPercent,
        duration: -1, // Permanent
        conditions: [
          'Grandfathered custom plan pricing',
          'Permanent discount to preserve current cost',
          'Limited to current organization'
        ],
        eligiblePlans: [targetPlan],
        stackable: false
      };

    } catch (error) {
      log_error(error);
      return null;
    }
  }

  /**
   * Calculate new plan cost
   */
  private static calculateNewPlanCost(planTier: PlanTier, userCount: number): number {
    const pricing = this.PLAN_PRICING[planTier];
    
    if (planTier === PlanTier.ENTERPRISE) {
      return pricing.monthly;
    }
    
    if (planTier === PlanTier.PRO_LARGE || planTier === PlanTier.BUSINESS_LARGE) {
      const baseUsers = pricing.baseUsers || 0;
      const extraUsers = Math.max(0, userCount - baseUsers);
      return pricing.monthly + (extraUsers * (pricing.extraUserCost || 0));
    }
    
    return pricing.monthly * userCount;
  }

  /**
   * Get admin analytics for custom plan mappings
   */
  public static async getCustomPlanAnalytics(): Promise<{
    totalCustomPlans: number;
    mappedPlans: number;
    preservePricingCount: number;
    avgFeatureMatch: number;
    popularTargetPlans: { plan: string; count: number }[];
    potentialRevenue: number;
  }> {
    const query = `
      WITH custom_plan_stats AS (
        SELECT 
          COUNT(*) as total_custom_plans,
          COUNT(lcpm.id) as mapped_plans,
          COUNT(CASE WHEN lcpm.preserve_pricing = true THEN 1 END) as preserve_pricing_count,
          AVG(lcpm.feature_match_percentage) as avg_feature_match
        FROM licensing_custom_subs lcs
        LEFT JOIN licensing_custom_plan_mappings lcpm ON lcpm.custom_plan_id = lcs.id
      ),
      target_plan_distribution AS (
        SELECT 
          lcpm.new_plan_tier as plan,
          COUNT(*) as count
        FROM licensing_custom_plan_mappings lcpm
        GROUP BY lcpm.new_plan_tier
        ORDER BY count DESC
      ),
      revenue_potential AS (
        SELECT 
          SUM(
            CASE 
              WHEN lcpm.new_plan_tier = 'PRO_SMALL' THEN 9.99 * 12
              WHEN lcpm.new_plan_tier = 'BUSINESS_SMALL' THEN 14.99 * 12
              WHEN lcpm.new_plan_tier = 'PRO_LARGE' THEN 69 * 12
              WHEN lcpm.new_plan_tier = 'BUSINESS_LARGE' THEN 99 * 12
              WHEN lcpm.new_plan_tier = 'ENTERPRISE' THEN 349 * 12
              ELSE 0
            END - COALESCE(lcs.monthly_price * 12, 0)
          ) as potential_annual_revenue
        FROM licensing_custom_plan_mappings lcpm
        JOIN licensing_custom_subs lcs ON lcs.id = lcpm.custom_plan_id
      )
      SELECT 
        cps.*,
        rp.potential_annual_revenue,
        json_agg(json_build_object('plan', tpd.plan, 'count', tpd.count)) as popular_plans
      FROM custom_plan_stats cps
      CROSS JOIN revenue_potential rp
      LEFT JOIN target_plan_distribution tpd ON true
      GROUP BY cps.total_custom_plans, cps.mapped_plans, cps.preserve_pricing_count, cps.avg_feature_match, rp.potential_annual_revenue
    `;

    const result = await db.query(query);
    const data = result.rows[0];

    return {
      totalCustomPlans: Number(data?.total_custom_plans) || 0,
      mappedPlans: Number(data?.mapped_plans) || 0,
      preservePricingCount: Number(data?.preserve_pricing_count) || 0,
      avgFeatureMatch: Number(data?.avg_feature_match) || 0,
      popularTargetPlans: data?.popular_plans?.filter((p: any) => p.plan) || [],
      potentialRevenue: Number(data?.potential_annual_revenue) || 0
    };
  }
}