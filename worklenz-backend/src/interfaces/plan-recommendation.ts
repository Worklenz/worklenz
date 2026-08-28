export interface UserAnalytics {
  organizationId: string;
  userType: UserType;
  currentPlan?: LegacyPlan;
  usageMetrics: UsageMetrics;
  migrationEligibility: MigrationEligibility;
  appSumoStatus?: AppSumoStatus;
  customPlanDetails?: CustomPlanDetails;
}

export interface UsageMetrics {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  activeProjects: number;
  storageUsed: number; // in bytes
  averageProjectComplexity: number;
  teamCollaborationIndex: number;
  featureUtilization: FeatureUtilization;
  growthTrend: GrowthTrend;
  peakUsagePeriods: PeakUsage[];
}

export interface FeatureUtilization {
  ganttCharts: number; // 0-1 usage ratio
  timeTracking: number;
  customFields: number;
  reporting: number;
  integrations: number;
  advancedPermissions: number;
  clientPortal: number;
  resourceManagement: number;
}

export interface GrowthTrend {
  userGrowthRate: number; // monthly percentage
  projectGrowthRate: number;
  storageGrowthRate: number;
  predicted3MonthUsers: number;
  predicted6MonthUsers: number;
  predicted12MonthUsers: number;
}

export interface PeakUsage {
  date: Date;
  userCount: number;
  projectCount: number;
  reason?: string; // e.g., "Holiday project rush", "Team expansion"
}

export interface LegacyPlan {
  id: string;
  name: string;
  type: LegacyPlanType;
  price: number;
  currency: string;
  userLimit: number;
  features: LegacyPlanFeatures;
  subscriptionDate: Date;
  renewalDate?: Date;
  status: LegacyPlanStatus;
}

export interface LegacyPlanFeatures {
  unlimitedProjects: boolean;
  storageLimit: number; // in GB
  customFields: boolean;
  ganttCharts: boolean;
  timeTracking: boolean;
  reporting: boolean;
  integrations: boolean;
  clientPortal: boolean;
  advancedPermissions: boolean;
  priority: "basic" | "standard" | "premium" | "enterprise";
}

export interface MigrationEligibility {
  isEligible: boolean;
  eligiblePlans: string[];
  recommendedPlan: string;
  migrationWindow?: MigrationWindow;
  discounts: MigrationDiscount[];
  preservedBenefits: string[];
  upgradeReasons: UpgradeReason[];
}

export interface MigrationWindow {
  startDate: Date;
  endDate: Date;
  urgency: "low" | "medium" | "high" | "critical";
  remainingDays: number;
}

export interface MigrationDiscount {
  code: string;
  type: DiscountType;
  value: number; // percentage or fixed amount
  duration: number; // months
  conditions: string[];
  eligiblePlans: string[];
  stackable: boolean;
}

export interface AppSumoStatus {
  isAppSumoUser: boolean;
  purchaseDate?: Date;
  remainingMigrationDays?: number;
  eligibleForSpecialDiscount: boolean;
  minimumPlanTier: "BUSINESS_SMALL" | "BUSINESS_LARGE" | "ENTERPRISE";
  specialOfferDiscount: number; // 50% for AppSumo users
  alreadyMigrated?: boolean;
}

export interface PostDiscountOptions {
  canStillMigrate: boolean;
  standardPricing: boolean;
  futureCampaigns: FutureCampaignInfo;
  migrationBenefits: string[];
  contactSupport: ContactInfo;
}

export interface FutureCampaignInfo {
  possibleFutureCampaigns: boolean;
  notificationSignup: boolean;
  expectedTimeframe: string;
  potentialDiscounts: string[];
}

export interface ContactInfo {
  email: string;
  subject: string;
  supportHours: string;
}

export interface CustomPlanDetails {
  currentFeatures: LegacyPlanFeatures;
  currentPricing: number;
  grandfatheredBenefits: string[];
  preservationEligible: boolean;
  equivalentNewPlans: PlanEquivalency[];
}

export interface PlanEquivalency {
  newPlanId: string;
  featureMatchPercent: number;
  costComparison: CostComparison;
  migrationComplexity: "simple" | "moderate" | "complex";
  recommendationScore: number;
}

export interface CostComparison {
  currentCost: number;
  newPlanCost: number;
  differenceAmount: number;
  differencePercent: number;
  withDiscountCost?: number;
  breakEvenMonths?: number;
}

export interface PlanRecommendation {
  planId: string;
  planName: string;
  planTier: PlanTier;
  recommendationScore: number;
  confidenceLevel: number;
  matchReasons: MatchReason[];
  costAnalysis: CostComparison;
  featureComparison: FeatureComparison;
  migrationComplexity: "simple" | "moderate" | "complex";
  timeline: RecommendationTimeline;
  discounts: MigrationDiscount[];
  preservedBenefits: string[];
}

export interface FeatureComparison {
  currentFeatures: string[];
  newFeatures: string[];
  upgradedFeatures: string[];
  removedFeatures: string[];
  featureMatchPercent: number;
  criticalFeaturesMet: boolean;
}

export interface MatchReason {
  factor: MatchFactor;
  weight: number;
  score: number;
  explanation: string;
}

export interface RecommendationTimeline {
  immediateAction: boolean;
  migrationWindow?: MigrationWindow;
  optimalMigrationDate?: Date;
  urgencyIndicators: string[];
}

export interface UpgradeReason {
  reason: string;
  priority: "low" | "medium" | "high" | "critical";
  impact: string;
  category: UpgradeCategory;
}

// Enums
export enum UserType {
  TRIAL = "trial",
  FREE = "free", 
  CUSTOM_PLAN = "custom_plan",
  APPSUMO = "appsumo",
  NEW_USER = "new_user",
  ACTIVE_SUBSCRIBER = "active_subscriber"
}

export enum LegacyPlanType {
  TRIAL = "trial",
  FREE = "free",
  CUSTOM = "custom",
  APPSUMO = "appsumo",
  LEGACY_PAID = "legacy_paid"
}

export enum LegacyPlanStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
  SUSPENDED = "suspended"
}

export enum PlanTier {
  FREE = "FREE",
  PRO_SMALL = "PRO_SMALL",
  BUSINESS_SMALL = "BUSINESS_SMALL", 
  PRO_LARGE = "PRO_LARGE",
  BUSINESS_LARGE = "BUSINESS_LARGE",
  ENTERPRISE = "ENTERPRISE"
}

export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED_AMOUNT = "fixed_amount",
  FREE_MONTHS = "free_months",
  BOGO = "bogo"
}

export enum MatchFactor {
  USER_COUNT = "user_count",
  FEATURE_REQUIREMENTS = "feature_requirements",
  BUDGET_ALIGNMENT = "budget_alignment",
  USAGE_PATTERNS = "usage_patterns",
  GROWTH_TRAJECTORY = "growth_trajectory",
  INDUSTRY_STANDARD = "industry_standard",
  LEGACY_PLAN_EQUIVALENCY = "legacy_plan_equivalency"
}

export enum UpgradeCategory {
  CAPACITY = "capacity",
  FEATURES = "features", 
  PERFORMANCE = "performance",
  SUPPORT = "support",
  COMPLIANCE = "compliance",
  COST_OPTIMIZATION = "cost_optimization"
}

// Service Response Types
export interface PlanRecommendationResponse {
  userAnalytics: UserAnalytics;
  recommendations: PlanRecommendation[];
  urgentActions: UrgentAction[];
  migrationSummary: MigrationSummary;
  specialOffers: SpecialOffer[];
}

export interface UrgentAction {
  type: "migration_deadline" | "capacity_limit" | "trial_expiry" | "payment_failure";
  message: string;
  deadline?: Date;
  severity: "info" | "warning" | "error" | "critical";
  actionRequired: string;
}

export interface MigrationSummary {
  eligibleForMigration: boolean;
  recommendedAction: "migrate_now" | "plan_migration" | "stay_current" | "evaluate_options";
  timeline: string;
  estimatedSavings?: number;
  riskFactors: string[];
}

export interface SpecialOffer {
  id: string;
  title: string;
  description: string;
  discount: MigrationDiscount;
  validUntil: Date;
  eligibilityRequirements: string[];
  featured: boolean;
}

export interface MigrationCostBenefit {
  currentPlan: {
    name: string;
    monthlyCost: number;
    annualCost: number;
    features: string[];
  };
  targetPlan: {
    name: string;
    monthlyCost: number;
    annualCost: number;
    features: string[];
  };
  costAnalysis: {
    monthlyDifference: number;
    annualDifference: number;
    percentageChange: number;
    paybackPeriod?: number;
    totalCostOfOwnership: {
      year1: number;
      year2: number;
      year3: number;
    };
  };
  benefitAnalysis: {
    newFeatures: string[];
    enhancedFeatures: string[];
    retainedFeatures: string[];
    removedFeatures: string[];
    productivityGains: number;
    riskReduction: number;
  };
  recommendation: {
    score: number;
    confidence: number;
    reasoning: string[];
    timeline: "immediate" | "short_term" | "medium_term" | "long_term";
  };
}

export interface PlanPricing {
  monthly: number;
  annual: number;
  maxUsers?: number;
  baseUsers?: number;
  extraUserCost?: number;
}