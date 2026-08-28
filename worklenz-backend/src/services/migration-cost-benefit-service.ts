import db from "../config/db";
import { log_error } from "../shared/utils";
import {
  CostComparison,
  PlanTier,
  UserType,
  MigrationDiscount,
  UsageMetrics,
  CustomPlanDetails,
  AppSumoStatus
} from "../interfaces/plan-recommendation";

export interface DetailedMigrationCostBenefit {
  costAnalysis: DetailedCostAnalysis;
  benefitAnalysis: BenefitAnalysis;
  riskAssessment: RiskAssessment;
  timeline: MigrationTimeline;
  recommendations: MigrationRecommendation[];
  scenarios: MigrationScenario[];
}

export interface DetailedCostAnalysis {
  currentMonthlyCost: number;
  newMonthlyCost: number;
  firstYearCost: number;
  threeYearCost: number;
  fiveYearCost: number;
  discountSavings: number;
  migrationCosts: number;
  totalCostOfOwnership: number;
  paybackPeriod?: number; // months
  breakEvenPoint?: Date;
  costPerUser: CostPerUserAnalysis;
}

export interface CostPerUserAnalysis {
  currentCostPerUser: number;
  newCostPerUser: number;
  savingsPerUser: number;
  scalingEfficiency: number;
}

export interface BenefitAnalysis {
  featureUpgrades: FeatureBenefit[];
  productivityGains: ProductivityBenefit[];
  scalabilityBenefits: ScalabilityBenefit[];
  complianceBenefits: ComplianceBenefit[];
  supportImprovements: SupportBenefit[];
  quantifiedValue: number; // Annual value in dollars
}

export interface FeatureBenefit {
  feature: string;
  currentState: 'unavailable' | 'limited' | 'basic' | 'advanced';
  newState: 'unavailable' | 'limited' | 'basic' | 'advanced';
  impact: 'low' | 'medium' | 'high' | 'critical';
  estimatedValue: number; // Annual value
  description: string;
}

export interface ProductivityBenefit {
  area: string;
  timeRaving: number; // hours per month
  efficiencyGain: number; // percentage
  monetaryValue: number; // annual value
  description: string;
}

export interface ScalabilityBenefit {
  metric: string;
  currentLimit: number;
  newLimit: number;
  growthAccommodation: number; // months of growth covered
  description: string;
}

export interface ComplianceBenefit {
  requirement: string;
  currentCompliance: boolean;
  newCompliance: boolean;
  riskReduction: number; // percentage
  description: string;
}

export interface SupportBenefit {
  supportType: string;
  currentLevel: string;
  newLevel: string;
  responseTimeImprovement: string;
  description: string;
}

export interface RiskAssessment {
  migrationRisks: MigrationRisk[];
  businessRisks: BusinessRisk[];
  technicalRisks: TechnicalRisk[];
  mitigationStrategies: MitigationStrategy[];
  overallRiskScore: number; // 0-100
}

export interface MigrationRisk {
  risk: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
}

export interface BusinessRisk {
  risk: string;
  impact: string;
  mitigation: string;
}

export interface TechnicalRisk {
  risk: string;
  impact: string;
  mitigation: string;
}

export interface MitigationStrategy {
  risk: string;
  strategy: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}

export interface MigrationTimeline {
  phases: MigrationPhase[];
  totalDuration: number; // days
  criticalPath: string[];
  dependencies: string[];
}

export interface MigrationPhase {
  phase: string;
  duration: number; // days
  tasks: string[];
  resources: string[];
  dependencies: string[];
}

export interface MigrationRecommendation {
  type: 'proceed' | 'delay' | 'modify' | 'reject';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  action: string;
  timeline: string;
}

export interface MigrationScenario {
  name: string;
  description: string;
  costAnalysis: DetailedCostAnalysis;
  benefits: number; // annual value
  risks: number; // risk score
  timeline: number; // days
  recommendationScore: number;
}

export class MigrationCostBenefitService {
  
  private static readonly HOURLY_RATE = 50; // Average hourly rate for productivity calculations
  private static readonly MIGRATION_BASE_COST = 500; // Base migration cost in dollars

  /**
   * Perform comprehensive cost-benefit analysis for migration
   */
  public static async performCostBenefitAnalysis(
    organizationId: string,
    targetPlan: PlanTier,
    userType: UserType,
    usageMetrics: UsageMetrics,
    customPlanDetails?: CustomPlanDetails,
    appSumoStatus?: AppSumoStatus,
    discounts: MigrationDiscount[] = []
  ): Promise<DetailedMigrationCostBenefit> {
    try {
      const [
        costAnalysis,
        benefitAnalysis,
        riskAssessment,
        timeline
      ] = await Promise.all([
        this.performDetailedCostAnalysis(organizationId, targetPlan, userType, customPlanDetails, discounts),
        this.performBenefitAnalysis(targetPlan, userType, usageMetrics),
        this.performRiskAssessment(organizationId, targetPlan, userType, customPlanDetails),
        this.calculateMigrationTimeline(organizationId, targetPlan, userType)
      ]);

      const recommendations = this.generateRecommendations(costAnalysis, benefitAnalysis, riskAssessment);
      const scenarios = this.generateScenarios(organizationId, targetPlan, userType, usageMetrics, discounts);

      return {
        costAnalysis,
        benefitAnalysis,
        riskAssessment,
        timeline,
        recommendations,
        scenarios
      };

    } catch (error) {
      log_error(error);
      throw new Error("Failed to perform cost-benefit analysis");
    }
  }

  /**
   * Perform detailed cost analysis
   */
  private static async performDetailedCostAnalysis(
    organizationId: string,
    targetPlan: PlanTier,
    userType: UserType,
    customPlanDetails?: CustomPlanDetails,
    discounts: MigrationDiscount[] = []
  ): Promise<DetailedCostAnalysis> {
    const userCount = await this.getUserCount(organizationId);
    const currentMonthlyCost = customPlanDetails?.currentPricing || 0;
    const newMonthlyCost = this.calculatePlanCost(targetPlan, userCount);
    
    // Apply discounts
    const { discountedCost, totalDiscount } = this.applyDiscounts(newMonthlyCost, discounts);
    const effectiveMonthlyCost = discountedCost;

    // Calculate long-term costs
    const firstYearCost = this.calculateFirstYearCost(effectiveMonthlyCost, discounts);
    const threeYearCost = this.calculateMultiYearCost(effectiveMonthlyCost, discounts, 36);
    const fiveYearCost = this.calculateMultiYearCost(effectiveMonthlyCost, discounts, 60);

    // Migration costs
    const migrationCosts = this.calculateMigrationCosts(userType, userCount);

    // Calculate payback period and break-even
    const monthlySavings = currentMonthlyCost - effectiveMonthlyCost;
    const paybackPeriod = monthlySavings > 0 ? Math.ceil(migrationCosts / monthlySavings) : undefined;
    const breakEvenPoint = paybackPeriod ? new Date(Date.now() + paybackPeriod * 30 * 24 * 60 * 60 * 1000) : undefined;

    // Cost per user analysis
    const costPerUser = this.calculateCostPerUser(currentMonthlyCost, effectiveMonthlyCost, userCount);

    // Total cost of ownership
    const totalCostOfOwnership = fiveYearCost + migrationCosts;

    return {
      currentMonthlyCost,
      newMonthlyCost: effectiveMonthlyCost,
      firstYearCost,
      threeYearCost,
      fiveYearCost,
      discountSavings: totalDiscount * 12, // Annual savings
      migrationCosts,
      totalCostOfOwnership,
      paybackPeriod,
      breakEvenPoint,
      costPerUser
    };
  }

  /**
   * Apply discounts to calculate effective cost
   */
  private static applyDiscounts(baseCost: number, discounts: MigrationDiscount[]): { discountedCost: number; totalDiscount: number } {
    let discountedCost = baseCost;
    let totalDiscount = 0;

    for (const discount of discounts) {
      if (discount.type === 'percentage') {
        const discountAmount = discountedCost * (discount.value / 100);
        discountedCost -= discountAmount;
        totalDiscount += discountAmount;
      } else if (discount.type === 'fixed_amount') {
        discountedCost -= discount.value;
        totalDiscount += discount.value;
      }
    }

    return { discountedCost: Math.max(0, discountedCost), totalDiscount };
  }

  /**
   * Calculate first year cost considering discount durations
   */
  private static calculateFirstYearCost(monthlyCost: number, discounts: MigrationDiscount[]): number {
    let totalCost = 0;
    
    // Find the primary discount (highest value)
    const primaryDiscount = discounts.reduce((prev, current) => 
      (prev.value > current.value) ? prev : current, discounts[0]
    );

    if (primaryDiscount && primaryDiscount.duration > 0 && primaryDiscount.duration < 12) {
      // Discount for part of the year
      const discountedMonths = Math.min(primaryDiscount.duration, 12);
      const regularMonths = 12 - discountedMonths;
      
      const { discountedCost } = this.applyDiscounts(monthlyCost, [primaryDiscount]);
      totalCost = (discountedCost * discountedMonths) + (monthlyCost * regularMonths);
    } else {
      totalCost = monthlyCost * 12;
    }

    return totalCost;
  }

  /**
   * Calculate multi-year costs
   */
  private static calculateMultiYearCost(monthlyCost: number, discounts: MigrationDiscount[], months: number): number {
    const primaryDiscount = discounts.reduce((prev, current) => 
      (prev.value > current.value) ? prev : current, discounts[0]
    );

    if (primaryDiscount && primaryDiscount.duration > 0) {
      const discountedMonths = Math.min(primaryDiscount.duration, months);
      const regularMonths = months - discountedMonths;
      
      const { discountedCost } = this.applyDiscounts(monthlyCost, [primaryDiscount]);
      return (discountedCost * discountedMonths) + (monthlyCost * regularMonths);
    }

    return monthlyCost * months;
  }

  /**
   * Calculate migration costs
   */
  private static calculateMigrationCosts(userType: UserType, userCount: number): number {
    let baseCost = this.MIGRATION_BASE_COST;
    
    // Adjust based on user type complexity
    switch (userType) {
      case UserType.FREE:
      case UserType.TRIAL:
        baseCost *= 0.5; // Simple migration
        break;
      case UserType.CUSTOM_PLAN:
        baseCost *= 2; // Complex migration
        break;
      case UserType.APPSUMO:
        baseCost *= 1.2; // Moderate complexity
        break;
    }

    // Scale with user count
    const userComplexity = Math.min(userCount * 50, 1000); // Cap at $1000
    
    return baseCost + userComplexity;
  }

  /**
   * Calculate cost per user analysis
   */
  private static calculateCostPerUser(currentCost: number, newCost: number, userCount: number): CostPerUserAnalysis {
    const currentCostPerUser = userCount > 0 ? currentCost / userCount : 0;
    const newCostPerUser = userCount > 0 ? newCost / userCount : 0;
    const savingsPerUser = currentCostPerUser - newCostPerUser;
    
    // Calculate scaling efficiency (how well the plan scales with more users)
    const scalingEfficiency = this.calculateScalingEfficiency(newCostPerUser, userCount);

    return {
      currentCostPerUser,
      newCostPerUser,
      savingsPerUser,
      scalingEfficiency
    };
  }

  /**
   * Calculate scaling efficiency
   */
  private static calculateScalingEfficiency(costPerUser: number, currentUsers: number): number {
    // Plans with lower per-user costs are more efficient
    // Plans that accommodate more users without linear cost increase are more efficient
    const baseCost = 10; // Baseline cost per user
    const efficiency = Math.max(0, (baseCost - costPerUser) / baseCost);
    
    // Adjust for current scale
    const scaleBonus = Math.min(currentUsers / 20, 1) * 0.2; // Bonus for larger teams
    
    return Math.min(1, efficiency + scaleBonus);
  }

  /**
   * Perform benefit analysis
   */
  private static async performBenefitAnalysis(
    targetPlan: PlanTier,
    userType: UserType,
    usageMetrics: UsageMetrics
  ): Promise<BenefitAnalysis> {
    const featureUpgrades = this.analyzeFeatureUpgrades(targetPlan, userType);
    const productivityGains = this.calculateProductivityGains(targetPlan, usageMetrics);
    const scalabilityBenefits = this.analyzeScalabilityBenefits(targetPlan, usageMetrics);
    const complianceBenefits = this.analyzeComplianceBenefits(targetPlan);
    const supportImprovements = this.analyzeSupportImprovements(targetPlan);

    // Calculate total quantified value
    const quantifiedValue = 
      featureUpgrades.reduce((sum, f) => sum + f.estimatedValue, 0) +
      productivityGains.reduce((sum, p) => sum + p.monetaryValue, 0);

    return {
      featureUpgrades,
      productivityGains,
      scalabilityBenefits,
      complianceBenefits,
      supportImprovements,
      quantifiedValue
    };
  }

  /**
   * Analyze feature upgrades
   */
  private static analyzeFeatureUpgrades(targetPlan: PlanTier, userType: UserType): FeatureBenefit[] {
    const benefits: FeatureBenefit[] = [];

    // Define feature benefits based on target plan
    const planFeatures = {
      [PlanTier.FREE]: [],
      [PlanTier.PRO_SMALL]: [
        { feature: 'Gantt Charts', newState: 'advanced' as const, estimatedValue: 2400 },
        { feature: 'Time Tracking', newState: 'advanced' as const, estimatedValue: 1800 },
        { feature: 'Custom Fields', newState: 'basic' as const, estimatedValue: 1200 }
      ],
      [PlanTier.BUSINESS_SMALL]: [
        { feature: 'Advanced Reporting', newState: 'advanced' as const, estimatedValue: 3600 },
        { feature: 'Client Portal', newState: 'advanced' as const, estimatedValue: 2400 },
        { feature: 'Resource Management', newState: 'basic' as const, estimatedValue: 1800 },
        { feature: 'Advanced Permissions', newState: 'advanced' as const, estimatedValue: 1200 }
      ],
      [PlanTier.PRO_LARGE]: [
        { feature: 'Increased User Capacity', newState: 'advanced' as const, estimatedValue: 4800 },
        { feature: 'Enhanced Storage', newState: 'advanced' as const, estimatedValue: 1200 }
      ],
      [PlanTier.BUSINESS_LARGE]: [
        { feature: 'Enterprise Reporting', newState: 'advanced' as const, estimatedValue: 6000 },
        { feature: 'Advanced Resource Management', newState: 'advanced' as const, estimatedValue: 4800 },
        { feature: 'Enhanced Client Portal', newState: 'advanced' as const, estimatedValue: 3600 }
      ],
      [PlanTier.ENTERPRISE]: [
        { feature: 'Unlimited Users', newState: 'advanced' as const, estimatedValue: 12000 },
        { feature: 'SSO Integration', newState: 'advanced' as const, estimatedValue: 6000 },
        { feature: 'Priority Support', newState: 'advanced' as const, estimatedValue: 3600 },
        { feature: 'Custom Integrations', newState: 'advanced' as const, estimatedValue: 4800 }
      ]
    };

    const features = planFeatures[targetPlan] || [];
    
    for (const feature of features) {
      benefits.push({
        feature: feature.feature,
        currentState: userType === UserType.FREE ? 'unavailable' : 'limited',
        newState: feature.newState,
        impact: feature.estimatedValue > 3000 ? 'high' : feature.estimatedValue > 1500 ? 'medium' : 'low',
        estimatedValue: feature.estimatedValue,
        description: `Upgrade to ${feature.newState} ${feature.feature.toLowerCase()} capabilities`
      });
    }

    return benefits;
  }

  /**
   * Calculate productivity gains
   */
  private static calculateProductivityGains(targetPlan: PlanTier, usageMetrics: UsageMetrics): ProductivityBenefit[] {
    const gains: ProductivityBenefit[] = [];
    const userCount = usageMetrics.totalUsers;

    // Base productivity gains by plan tier
    if ([PlanTier.PRO_SMALL, PlanTier.PRO_LARGE].includes(targetPlan)) {
      gains.push({
        area: 'Project Planning',
        timeRaving: userCount * 2, // 2 hours per user per month
        efficiencyGain: 15,
        monetaryValue: userCount * 2 * this.HOURLY_RATE * 12,
        description: 'Improved project planning with Gantt charts and time tracking'
      });
    }

    if ([PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE].includes(targetPlan)) {
      gains.push({
        area: 'Reporting & Analytics',
        timeRaving: userCount * 4, // 4 hours per user per month
        efficiencyGain: 25,
        monetaryValue: userCount * 4 * this.HOURLY_RATE * 12,
        description: 'Advanced reporting reduces time spent on manual status updates'
      });

      gains.push({
        area: 'Client Communication',
        timeRaving: userCount * 1.5, // 1.5 hours per user per month
        efficiencyGain: 20,
        monetaryValue: userCount * 1.5 * this.HOURLY_RATE * 12,
        description: 'Client portal reduces communication overhead'
      });
    }

    if (targetPlan === PlanTier.ENTERPRISE) {
      gains.push({
        area: 'Team Management',
        timeRaving: userCount * 3, // 3 hours per user per month
        efficiencyGain: 30,
        monetaryValue: userCount * 3 * this.HOURLY_RATE * 12,
        description: 'Advanced permissions and SSO reduce administrative overhead'
      });
    }

    return gains;
  }

  /**
   * Analyze scalability benefits
   */
  private static analyzeScalabilityBenefits(targetPlan: PlanTier, usageMetrics: UsageMetrics): ScalabilityBenefit[] {
    const benefits: ScalabilityBenefit[] = [];
    const currentUsers = usageMetrics.totalUsers;
    const growthRate = usageMetrics.growthTrend.userGrowthRate;

    // User capacity benefits
    const planLimits = {
      [PlanTier.FREE]: 3,
      [PlanTier.PRO_SMALL]: 5,
      [PlanTier.BUSINESS_SMALL]: 5,
      [PlanTier.PRO_LARGE]: 50,
      [PlanTier.BUSINESS_LARGE]: 100,
      [PlanTier.ENTERPRISE]: -1 // Unlimited
    };

    const newLimit = planLimits[targetPlan];
    if (newLimit > currentUsers || newLimit === -1) {
      const growthAccommodation = newLimit === -1 ? 60 : Math.floor((newLimit - currentUsers) / (growthRate * currentUsers));
      
      benefits.push({
        metric: 'User Capacity',
        currentLimit: currentUsers,
        newLimit: newLimit === -1 ? 1000 : newLimit, // Display value for unlimited
        growthAccommodation,
        description: `Accommodates ${growthAccommodation} months of projected user growth`
      });
    }

    // Storage benefits
    benefits.push({
      metric: 'Storage Capacity',
      currentLimit: 5, // Assume current 5GB
      newLimit: this.getStorageLimit(targetPlan),
      growthAccommodation: 24, // Estimate 24 months
      description: 'Enhanced storage supports growing file attachments and data'
    });

    // Project capacity
    if (targetPlan !== PlanTier.FREE) {
      benefits.push({
        metric: 'Project Capacity',
        currentLimit: usageMetrics.totalProjects,
        newLimit: -1, // Unlimited for paid plans
        growthAccommodation: 60,
        description: 'Unlimited projects support business growth'
      });
    }

    return benefits;
  }

  /**
   * Get storage limit for plan tier
   */
  private static getStorageLimit(planTier: PlanTier): number {
    const limits = {
      [PlanTier.FREE]: 5,
      [PlanTier.PRO_SMALL]: 100,
      [PlanTier.BUSINESS_SMALL]: 500,
      [PlanTier.PRO_LARGE]: 1000,
      [PlanTier.BUSINESS_LARGE]: 2000,
      [PlanTier.ENTERPRISE]: -1 // Unlimited
    };
    return limits[planTier];
  }

  /**
   * Analyze compliance benefits
   */
  private static analyzeComplianceBenefits(targetPlan: PlanTier): ComplianceBenefit[] {
    const benefits: ComplianceBenefit[] = [];

    if ([PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE].includes(targetPlan)) {
      benefits.push({
        requirement: 'Advanced Permissions',
        currentCompliance: false,
        newCompliance: true,
        riskReduction: 60,
        description: 'Role-based access control improves data security'
      });

      benefits.push({
        requirement: 'Audit Trail',
        currentCompliance: false,
        newCompliance: true,
        riskReduction: 40,
        description: 'Comprehensive activity logging for compliance'
      });
    }

    if (targetPlan === PlanTier.ENTERPRISE) {
      benefits.push({
        requirement: 'SSO Integration',
        currentCompliance: false,
        newCompliance: true,
        riskReduction: 80,
        description: 'Single sign-on reduces security risks'
      });

      benefits.push({
        requirement: 'Data Residency',
        currentCompliance: false,
        newCompliance: true,
        riskReduction: 30,
        description: 'Enhanced data control and residency options'
      });
    }

    return benefits;
  }

  /**
   * Analyze support improvements
   */
  private static analyzeSupportImprovements(targetPlan: PlanTier): SupportBenefit[] {
    const benefits: SupportBenefit[] = [];

    const supportLevels = {
      [PlanTier.FREE]: { level: 'Community', responseTime: '48+ hours' },
      [PlanTier.PRO_SMALL]: { level: 'Email Support', responseTime: '24 hours' },
      [PlanTier.BUSINESS_SMALL]: { level: 'Priority Support', responseTime: '12 hours' },
      [PlanTier.PRO_LARGE]: { level: 'Email Support', responseTime: '24 hours' },
      [PlanTier.BUSINESS_LARGE]: { level: 'Priority Support', responseTime: '8 hours' },
      [PlanTier.ENTERPRISE]: { level: 'Dedicated Support', responseTime: '4 hours' }
    };

    const newSupport = supportLevels[targetPlan];
    
    benefits.push({
      supportType: 'Technical Support',
      currentLevel: 'Community',
      newLevel: newSupport.level,
      responseTimeImprovement: newSupport.responseTime,
      description: `Upgrade to ${newSupport.level} with ${newSupport.responseTime} response time`
    });

    if ([PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE].includes(targetPlan)) {
      benefits.push({
        supportType: 'Onboarding',
        currentLevel: 'Self-service',
        newLevel: 'Guided onboarding',
        responseTimeImprovement: 'Immediate',
        description: 'Dedicated onboarding specialist for faster setup'
      });
    }

    if (targetPlan === PlanTier.ENTERPRISE) {
      benefits.push({
        supportType: 'Account Management',
        currentLevel: 'None',
        newLevel: 'Dedicated CSM',
        responseTimeImprovement: 'Proactive',
        description: 'Dedicated Customer Success Manager for ongoing optimization'
      });
    }

    return benefits;
  }

  /**
   * Perform risk assessment
   */
  private static async performRiskAssessment(
    organizationId: string,
    targetPlan: PlanTier,
    userType: UserType,
    customPlanDetails?: CustomPlanDetails
  ): Promise<RiskAssessment> {
    const migrationRisks = this.assessMigrationRisks(userType, customPlanDetails);
    const businessRisks = this.assessBusinessRisks(targetPlan, userType);
    const technicalRisks = this.assessTechnicalRisks(targetPlan);
    const mitigationStrategies = this.generateMitigationStrategies(migrationRisks, businessRisks, technicalRisks);
    const overallRiskScore = this.calculateOverallRiskScore(migrationRisks, businessRisks, technicalRisks);

    return {
      migrationRisks,
      businessRisks,
      technicalRisks,
      mitigationStrategies,
      overallRiskScore
    };
  }

  /**
   * Assess migration risks
   */
  private static assessMigrationRisks(userType: UserType, customPlanDetails?: CustomPlanDetails): MigrationRisk[] {
    const risks: MigrationRisk[] = [];

    // Data migration risk
    risks.push({
      risk: 'Data Migration',
      probability: 'low',
      impact: 'medium',
      mitigation: 'Comprehensive backup and testing procedures'
    });

    // User adoption risk
    if (userType === UserType.CUSTOM_PLAN) {
      risks.push({
        risk: 'User Resistance to Change',
        probability: 'medium',
        impact: 'medium',
        mitigation: 'Gradual rollout with training and support'
      });
    }

    // Feature compatibility risk
    if (customPlanDetails) {
      risks.push({
        risk: 'Feature Compatibility',
        probability: 'medium',
        impact: 'low',
        mitigation: 'Feature mapping analysis and alternative workflows'
      });
    }

    // Downtime risk
    risks.push({
      risk: 'Service Downtime',
      probability: 'low',
      impact: 'high',
      mitigation: 'Scheduled maintenance window and rollback plan'
    });

    return risks;
  }

  /**
   * Assess business risks
   */
  private static assessBusinessRisks(targetPlan: PlanTier, userType: UserType): BusinessRisk[] {
    const risks: BusinessRisk[] = [];

    // Budget risk
    risks.push({
      risk: 'Budget Overrun',
      impact: 'Additional unexpected costs during migration',
      mitigation: 'Detailed cost planning with 20% contingency buffer'
    });

    // Timeline risk
    risks.push({
      risk: 'Project Delays',
      impact: 'Extended migration timeline affecting business operations',
      mitigation: 'Phased migration approach with clear milestones'
    });

    // ROI risk
    if (targetPlan === PlanTier.ENTERPRISE) {
      risks.push({
        risk: 'ROI Achievement',
        impact: 'Difficulty realizing expected return on investment',
        mitigation: 'Clear KPI tracking and benefit realization plan'
      });
    }

    return risks;
  }

  /**
   * Assess technical risks
   */
  private static assessTechnicalRisks(targetPlan: PlanTier): TechnicalRisk[] {
    const risks: TechnicalRisk[] = [];

    // Integration risk
    risks.push({
      risk: 'Third-party Integrations',
      impact: 'Existing integrations may need reconfiguration',
      mitigation: 'Integration testing and vendor coordination'
    });

    // Performance risk
    if (targetPlan === PlanTier.ENTERPRISE) {
      risks.push({
        risk: 'Performance Optimization',
        impact: 'Advanced features may require system optimization',
        mitigation: 'Performance testing and infrastructure scaling'
      });
    }

    // Security risk
    risks.push({
      risk: 'Security Configuration',
      impact: 'New security features require proper configuration',
      mitigation: 'Security review and compliance verification'
    });

    return risks;
  }

  /**
   * Generate mitigation strategies
   */
  private static generateMitigationStrategies(
    migrationRisks: MigrationRisk[],
    businessRisks: BusinessRisk[],
    technicalRisks: TechnicalRisk[]
  ): MitigationStrategy[] {
    const strategies: MitigationStrategy[] = [];

    // Pre-migration strategies
    strategies.push({
      risk: 'Data Loss',
      strategy: 'Complete data backup and validation',
      effort: 'medium',
      timeline: '1-2 weeks before migration'
    });

    strategies.push({
      risk: 'User Disruption',
      strategy: 'Phased rollout with pilot group',
      effort: 'low',
      timeline: 'Ongoing during migration'
    });

    // Post-migration strategies
    strategies.push({
      risk: 'Feature Adoption',
      strategy: 'Training sessions and documentation',
      effort: 'medium',
      timeline: '1-4 weeks after migration'
    });

    strategies.push({
      risk: 'Performance Issues',
      strategy: 'Monitoring and optimization',
      effort: 'low',
      timeline: 'Ongoing post-migration'
    });

    return strategies;
  }

  /**
   * Calculate overall risk score
   */
  private static calculateOverallRiskScore(
    migrationRisks: MigrationRisk[],
    businessRisks: BusinessRisk[],
    technicalRisks: TechnicalRisk[]
  ): number {
    const probabilityWeights = { low: 1, medium: 2, high: 3 };
    const impactWeights = { low: 1, medium: 2, high: 3, critical: 4 };

    let totalRiskScore = 0;
    let totalRisks = 0;

    for (const risk of migrationRisks) {
      const score = probabilityWeights[risk.probability] * impactWeights[risk.impact];
      totalRiskScore += score;
      totalRisks++;
    }

    // Business and technical risks are treated as medium probability
    const otherRisks = businessRisks.length + technicalRisks.length;
    totalRiskScore += otherRisks * 2 * 2; // medium probability * medium impact
    totalRisks += otherRisks;

    const averageRiskScore = totalRisks > 0 ? totalRiskScore / totalRisks : 0;
    return Math.round((averageRiskScore / 12) * 100); // Normalize to 0-100 scale
  }

  /**
   * Calculate migration timeline
   */
  private static async calculateMigrationTimeline(
    organizationId: string,
    targetPlan: PlanTier,
    userType: UserType
  ): Promise<MigrationTimeline> {
    const phases: MigrationPhase[] = [];

    // Planning phase
    phases.push({
      phase: 'Planning & Preparation',
      duration: userType === UserType.CUSTOM_PLAN ? 7 : 3,
      tasks: ['Requirements analysis', 'Migration planning', 'Backup creation'],
      resources: ['Technical team', 'Project manager'],
      dependencies: ['Stakeholder approval']
    });

    // Migration phase
    phases.push({
      phase: 'Migration Execution',
      duration: userType === UserType.CUSTOM_PLAN ? 5 : 2,
      tasks: ['Account migration', 'Data transfer', 'Feature configuration'],
      resources: ['Technical team', 'Support team'],
      dependencies: ['Planning completion', 'Backup verification']
    });

    // Validation phase
    phases.push({
      phase: 'Testing & Validation',
      duration: 3,
      tasks: ['Feature testing', 'User acceptance testing', 'Performance validation'],
      resources: ['QA team', 'End users'],
      dependencies: ['Migration completion']
    });

    // Go-live phase
    phases.push({
      phase: 'Go-Live & Support',
      duration: 7,
      tasks: ['User training', 'Monitoring', 'Issue resolution'],
      resources: ['Support team', 'Training team'],
      dependencies: ['Validation completion']
    });

    const totalDuration = phases.reduce((sum, phase) => sum + phase.duration, 0);
    const criticalPath = ['Planning & Preparation', 'Migration Execution', 'Testing & Validation'];
    const dependencies = ['User approval', 'Data backup', 'Feature mapping'];

    return {
      phases,
      totalDuration,
      criticalPath,
      dependencies
    };
  }

  /**
   * Generate recommendations
   */
  private static generateRecommendations(
    costAnalysis: DetailedCostAnalysis,
    benefitAnalysis: BenefitAnalysis,
    riskAssessment: RiskAssessment
  ): MigrationRecommendation[] {
    const recommendations: MigrationRecommendation[] = [];

    // Cost-benefit recommendation
    const netBenefit = benefitAnalysis.quantifiedValue - costAnalysis.firstYearCost;
    if (netBenefit > 0) {
      recommendations.push({
        type: 'proceed',
        priority: 'high',
        reasoning: `Positive ROI of $${Math.round(netBenefit)} in first year`,
        action: 'Proceed with migration',
        timeline: 'Within 30 days'
      });
    } else if (netBenefit > -costAnalysis.firstYearCost * 0.1) {
      recommendations.push({
        type: 'modify',
        priority: 'medium',
        reasoning: 'Marginal cost-benefit ratio, consider optimization',
        action: 'Optimize migration scope or timing',
        timeline: 'Within 60 days'
      });
    }

    // Risk-based recommendation
    if (riskAssessment.overallRiskScore > 70) {
      recommendations.push({
        type: 'delay',
        priority: 'high',
        reasoning: 'High risk score requires additional risk mitigation',
        action: 'Implement risk mitigation strategies before proceeding',
        timeline: '30-60 days'
      });
    }

    // Urgency-based recommendation
    if (costAnalysis.paybackPeriod && costAnalysis.paybackPeriod <= 6) {
      recommendations.push({
        type: 'proceed',
        priority: 'critical',
        reasoning: `Fast payback period of ${costAnalysis.paybackPeriod} months`,
        action: 'Prioritize immediate migration',
        timeline: 'Within 14 days'
      });
    }

    return recommendations;
  }

  /**
   * Generate migration scenarios
   */
  private static generateScenarios(
    organizationId: string,
    targetPlan: PlanTier,
    userType: UserType,
    usageMetrics: UsageMetrics,
    discounts: MigrationDiscount[]
  ): MigrationScenario[] {
    // This would generate multiple scenarios (immediate, delayed, phased, etc.)
    // For brevity, returning a simplified version
    return [
      {
        name: 'Immediate Migration',
        description: 'Migrate immediately with current discounts',
        costAnalysis: {} as DetailedCostAnalysis, // Would be calculated
        benefits: 10000, // Annual benefits
        risks: 30, // Risk score
        timeline: 14, // Days
        recommendationScore: 85
      },
      {
        name: 'Delayed Migration',
        description: 'Wait 3 months for better timing',
        costAnalysis: {} as DetailedCostAnalysis,
        benefits: 9000,
        risks: 20,
        timeline: 90,
        recommendationScore: 75
      }
    ];
  }

  /**
   * Helper methods
   */
  private static async getUserCount(organizationId: string): Promise<number> {
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

  private static calculatePlanCost(planTier: PlanTier, userCount: number): number {
    const pricing = {
      [PlanTier.FREE]: 0,
      [PlanTier.PRO_SMALL]: 9.99 * userCount,
      [PlanTier.BUSINESS_SMALL]: 14.99 * userCount,
      [PlanTier.PRO_LARGE]: 69 + Math.max(0, userCount - 15) * 5.99,
      [PlanTier.BUSINESS_LARGE]: 99 + Math.max(0, userCount - 20) * 5.99,
      [PlanTier.ENTERPRISE]: 349
    };
    return pricing[planTier] || 0;
  }
}