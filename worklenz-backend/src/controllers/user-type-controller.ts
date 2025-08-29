import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

import { PlanRecommendationService } from "../services/plan-recommendation-service";
import { UserAnalyticsService } from "../services/user-analytics-service";
import { AppSumoMigrationService } from "../services/appsumo-migration-service";
import { CustomPlanMappingService } from "../services/custom-plan-mapping-service";

import {
  UserType,
  PlanTier
} from "../interfaces/plan-recommendation";

import db from "../config/db";
import { log_error } from "../shared/utils";

export default class UserTypeController extends WorklenzControllerBase {

  /**
   * Get current user type and capabilities
   * GET /api/users/type
   */
  @HandleExceptions()
  public static async getUserType(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const userId = req.user?.id;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const [userAnalytics, userProgression] = await Promise.all([
        PlanRecommendationService.generateRecommendations(organizationId),
        UserAnalyticsService.analyzeUserTypeProgression(organizationId)
      ]);

      const userTypeInfo = {
        userType: userAnalytics.userAnalytics.userType,
        capabilities: await this.getUserCapabilities(userAnalytics.userAnalytics.userType, organizationId),
        progression: {
          daysInCurrentType: userProgression.daysInCurrentType,
          progressionLikelihood: userProgression.progressionLikelihood,
          nextLikelyUserType: userProgression.nextLikelyUserType,
          behaviorPatterns: userProgression.behaviorPatterns
        },
        limits: await this.getCurrentLimits(userAnalytics.userAnalytics.userType, organizationId),
        upgradeOptions: userAnalytics.recommendations.slice(0, 3),
        specialStatuses: await this.getSpecialStatuses(organizationId),
        migrationEligibility: userAnalytics.userAnalytics.migrationEligibility
      };

      return res.status(200).send(new ServerResponse(true, userTypeInfo));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to retrieve user type information"));
    }
  }

  /**
   * Get legacy plan details
   * GET /api/users/legacy-plan
   */
  @HandleExceptions()
  public static async getLegacyPlan(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const [customPlanDetails, appSumoStatus, userAnalytics] = await Promise.all([
        CustomPlanMappingService.getCustomPlanMappings(organizationId),
        AppSumoMigrationService.checkAppSumoEligibility(organizationId),
        PlanRecommendationService.generateRecommendations(organizationId)
      ]);

      let legacyPlan = null;

      // Custom plan details
      if (customPlanDetails) {
        legacyPlan = {
          type: 'custom_plan',
          details: customPlanDetails,
          migrationOptions: customPlanDetails.equivalentNewPlans,
          preservationOptions: {
            canPreservePricing: customPlanDetails.preservationEligible,
            grandfatheredBenefits: customPlanDetails.grandfatheredBenefits
          }
        };
      }

      // AppSumo plan details
      if (appSumoStatus && appSumoStatus.isAppSumoUser) {
        const appSumoRecommendations = await AppSumoMigrationService.getAppSumoRecommendations(organizationId);
        
        legacyPlan = {
          type: 'appsumo_plan',
          details: {
            purchaseDate: appSumoStatus.purchaseDate,
            discountEligibility: appSumoStatus.eligibleForSpecialDiscount,
            remainingDays: appSumoStatus.remainingMigrationDays,
            specialOfferDiscount: appSumoStatus.specialOfferDiscount
          },
          migrationOptions: appSumoRecommendations?.eligiblePlans || [],
          specialOffers: {
            discountedMigration: appSumoStatus.eligibleForSpecialDiscount,
            postDiscountOptions: appSumoRecommendations?.postDiscountOptions || null
          }
        };
      }

      // Trial plan details
      if (userAnalytics.userAnalytics.userType === UserType.TRIAL) {
        const trialInfo = await this.getTrialInformation(organizationId);
        
        legacyPlan = {
          type: 'trial_plan',
          details: trialInfo,
          migrationOptions: userAnalytics.userAnalytics.migrationEligibility.eligiblePlans,
          urgentActions: userAnalytics.urgentActions
        };
      }

      // Free plan details
      if (userAnalytics.userAnalytics.userType === UserType.FREE) {
        const freeInfo = await this.getFreePlanInformation(organizationId);
        
        legacyPlan = {
          type: 'free_plan',
          details: freeInfo,
          migrationOptions: userAnalytics.userAnalytics.migrationEligibility.eligiblePlans,
          upgradeIncentives: userAnalytics.userAnalytics.migrationEligibility.discounts
        };
      }

      const response = {
        hasLegacyPlan: !!legacyPlan,
        legacyPlan,
        migrationHistory: await this.getMigrationHistory(organizationId),
        availableTransitions: await this.getAvailableTransitions(userAnalytics.userAnalytics.userType, organizationId)
      };

      return res.status(200).send(new ServerResponse(true, response));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to retrieve legacy plan information"));
    }
  }

  /**
   * Update user type (Admin only - for manual overrides)
   * PUT /api/users/type
   */
  @HandleExceptions()
  public static async updateUserType(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const { newUserType, reason, adminOverride } = req.body;
    
    if (!req.user?.is_admin && !adminOverride) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    if (!organizationId || !newUserType) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID and new user type are required"));
    }

    try {
      // Validate the user type transition
      const currentUserAnalytics = await PlanRecommendationService.generateRecommendations(organizationId);
      const currentUserType = currentUserAnalytics.userAnalytics.userType;

      const transitionValidation = await this.validateUserTypeTransition(
        currentUserType,
        newUserType as UserType,
        organizationId
      );

      if (!transitionValidation.isValid) {
        return res.status(400).send(new ServerResponse(false, null, transitionValidation.reason));
      }

      // Record the user type change
      const changeResult = await this.recordUserTypeChange({
        organizationId,
        currentUserType,
        newUserType: newUserType as UserType,
        reason,
        changedBy: req.user?.id,
        adminOverride
      });

      if (!changeResult.success) {
        return res.status(400).send(new ServerResponse(false, null, changeResult.message));
      }

      // Get updated user type information
      const updatedAnalytics = await PlanRecommendationService.generateRecommendations(organizationId);

      return res.status(200).send(new ServerResponse(true, {
        changeId: changeResult.changeId,
        previousType: currentUserType,
        newType: newUserType,
        effectiveDate: new Date(),
        updatedCapabilities: await this.getUserCapabilities(newUserType as UserType, organizationId),
        newMigrationOptions: updatedAnalytics.userAnalytics.migrationEligibility
      }, "User type updated successfully"));

    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to update user type"));
    }
  }

  /**
   * Get user type history and transitions
   * GET /api/users/type/history
   */
  @HandleExceptions()
  public static async getUserTypeHistory(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const { limit = 10 } = req.query;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    try {
      const history = await this.getUserTypeTransitionHistory(organizationId, parseInt(limit as string));
      const analytics = await this.getUserTypeAnalytics(organizationId);

      const response = {
        history,
        analytics: {
          totalTransitions: history.length,
          averageTimeInType: analytics.averageTimeInType,
          mostCommonProgression: analytics.mostCommonProgression,
          conversionRates: analytics.conversionRates
        },
        currentStatus: await this.getCurrentTypeStatus(organizationId)
      };

      return res.status(200).send(new ServerResponse(true, response));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to retrieve user type history"));
    }
  }

  /**
   * Check user type eligibility for specific actions
   * POST /api/users/type/check-eligibility
   */
  @HandleExceptions()
  public static async checkEligibility(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_team_id;
    const { actions } = req.body;
    
    if (!organizationId || !actions || !Array.isArray(actions)) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID and actions array are required"));
    }

    try {
      const userAnalytics = await PlanRecommendationService.generateRecommendations(organizationId);
      const currentUserType = userAnalytics.userAnalytics.userType;
      
      const eligibilityResults = [];

      for (const action of actions) {
        const eligibility = await this.checkActionEligibility(currentUserType, action, organizationId);
        eligibilityResults.push({
          action,
          eligible: eligibility.eligible,
          reason: eligibility.reason,
          requiredUserType: eligibility.requiredUserType,
          upgradeOptions: eligibility.upgradeOptions
        });
      }

      return res.status(200).send(new ServerResponse(true, {
        currentUserType,
        eligibilityResults,
        overallEligibilityScore: this.calculateOverallEligibilityScore(eligibilityResults),
        recommendedActions: this.getRecommendedActions(eligibilityResults, currentUserType)
      }));

    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to check eligibility"));
    }
  }

  /**
   * Helper methods
   */
  private static async getUserCapabilities(userType: UserType, organizationId: string): Promise<any> {
    const baseCapabilities = this.getBaseCapabilities(userType);
    const currentUsage = await UserAnalyticsService.analyzeUsagePatterns(organizationId);
    
    return {
      ...baseCapabilities,
      currentUsage: {
        users: currentUsage.totalUsers,
        projects: currentUsage.totalProjects,
        storage: currentUsage.storageUsed
      },
      utilizationRates: {
        users: baseCapabilities.limits.maxUsers > 0 ? 
          (currentUsage.totalUsers / baseCapabilities.limits.maxUsers) * 100 : 0,
        storage: baseCapabilities.limits.storageLimit > 0 ? 
          (currentUsage.storageUsed / baseCapabilities.limits.storageLimit) * 100 : 0
      }
    };
  }

  private static getBaseCapabilities(userType: UserType): any {
    const capabilities = {
      [UserType.FREE]: {
        features: ['Basic projects', 'Basic tasks', 'Basic reporting'],
        limits: { maxUsers: 3, maxProjects: -1, storageLimit: 5 * 1024 * 1024 * 1024 },
        support: 'Community',
        billing: 'Free'
      },
      [UserType.TRIAL]: {
        features: ['All features', 'Full access', 'Premium support'],
        limits: { maxUsers: 10, maxProjects: -1, storageLimit: 100 * 1024 * 1024 * 1024 },
        support: 'Email',
        billing: 'Trial period'
      },
      [UserType.CUSTOM_PLAN]: {
        features: ['Custom feature set', 'Grandfathered pricing'],
        limits: { maxUsers: -1, maxProjects: -1, storageLimit: -1 },
        support: 'Premium',
        billing: 'Custom pricing'
      },
      [UserType.APPSUMO]: {
        features: ['AppSumo feature set', 'Discount eligibility'],
        limits: { maxUsers: -1, maxProjects: -1, storageLimit: -1 },
        support: 'Standard',
        billing: 'AppSumo lifetime deal'
      },
      [UserType.NEW_USER]: {
        features: ['Basic access', 'Setup wizard'],
        limits: { maxUsers: 1, maxProjects: 1, storageLimit: 1024 * 1024 * 1024 },
        support: 'Self-service',
        billing: 'None'
      },
      [UserType.ACTIVE_SUBSCRIBER]: {
        features: ['Plan-specific features'],
        limits: { maxUsers: -1, maxProjects: -1, storageLimit: -1 },
        support: 'Plan-specific',
        billing: 'Active subscription'
      }
    };

    return capabilities[userType] || capabilities[UserType.FREE];
  }

  private static async getCurrentLimits(userType: UserType, organizationId: string): Promise<any> {
    const capabilities = this.getBaseCapabilities(userType);
    const currentUsage = await UserAnalyticsService.analyzeUsagePatterns(organizationId);
    
    return {
      users: {
        current: currentUsage.totalUsers,
        limit: capabilities.limits.maxUsers,
        remaining: capabilities.limits.maxUsers > 0 ? 
          capabilities.limits.maxUsers - currentUsage.totalUsers : -1
      },
      projects: {
        current: currentUsage.totalProjects,
        limit: capabilities.limits.maxProjects,
        remaining: capabilities.limits.maxProjects > 0 ? 
          capabilities.limits.maxProjects - currentUsage.totalProjects : -1
      },
      storage: {
        current: currentUsage.storageUsed,
        limit: capabilities.limits.storageLimit,
        remaining: capabilities.limits.storageLimit > 0 ? 
          capabilities.limits.storageLimit - currentUsage.storageUsed : -1
      }
    };
  }

  private static async getSpecialStatuses(organizationId: string): Promise<any> {
    const [appSumoStatus, customPlanStatus] = await Promise.all([
      AppSumoMigrationService.checkAppSumoEligibility(organizationId),
      CustomPlanMappingService.getCustomPlanMappings(organizationId)
    ]);

    const statuses = [];

    if (appSumoStatus && appSumoStatus.isAppSumoUser) {
      statuses.push({
        type: 'appsumo_user',
        active: true,
        details: {
          discountEligible: appSumoStatus.eligibleForSpecialDiscount,
          remainingDays: appSumoStatus.remainingMigrationDays
        }
      });
    }

    if (customPlanStatus) {
      statuses.push({
        type: 'custom_plan_user',
        active: true,
        details: {
          preservationEligible: customPlanStatus.preservationEligible,
          currentPricing: customPlanStatus.currentPricing
        }
      });
    }

    return statuses;
  }

  private static async getTrialInformation(organizationId: string): Promise<any> {
    const query = `
      SELECT trial_expire_date, created_at
      FROM organizations 
      WHERE id = $1
    `;
    
    const result = await db.query(query, [organizationId]);
    const data = result.rows[0];
    
    if (!data) return null;

    const now = new Date();
    const expireDate = new Date(data.trial_expire_date);
    const remainingDays = Math.max(0, Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      startDate: data.created_at,
      expireDate: data.trial_expire_date,
      remainingDays,
      status: remainingDays > 0 ? 'active' : 'expired'
    };
  }

  private static async getFreePlanInformation(organizationId: string): Promise<any> {
    const query = `
      SELECT created_at, user_type
      FROM organizations 
      WHERE id = $1
    `;
    
    const result = await db.query(query, [organizationId]);
    const data = result.rows[0];
    
    const daysSinceCreation = Math.floor((new Date().getTime() - new Date(data.created_at).getTime()) / (1000 * 60 * 60 * 24));

    return {
      startDate: data.created_at,
      daysSinceCreation,
      upgradeEligible: true,
      limitations: ['3 user limit', '5GB storage limit', 'Basic features only']
    };
  }

  private static async getMigrationHistory(organizationId: string): Promise<any[]> {
    const query = `
      SELECT 
        id, migration_type, from_plan, to_plan, migration_status,
        migration_context, created_at, completed_at, user_consent
      FROM licensing_migration_audit 
      WHERE organization_team_id = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    const result = await db.query(query, [organizationId]);
    return result.rows;
  }

  private static async getAvailableTransitions(currentUserType: UserType, organizationId: string): Promise<any[]> {
    const transitions = [];
    
    switch (currentUserType) {
      case UserType.FREE:
        transitions.push(
          { to: UserType.TRIAL, method: 'start_trial', requirements: [] },
          { to: UserType.ACTIVE_SUBSCRIBER, method: 'direct_upgrade', requirements: ['payment_method'] }
        );
        break;
      
      case UserType.TRIAL:
        transitions.push(
          { to: UserType.ACTIVE_SUBSCRIBER, method: 'trial_conversion', requirements: ['payment_method'] },
          { to: UserType.FREE, method: 'trial_expiry', requirements: [] }
        );
        break;
      
      case UserType.CUSTOM_PLAN:
        transitions.push(
          { to: UserType.ACTIVE_SUBSCRIBER, method: 'migration', requirements: ['plan_selection', 'migration_consent'] }
        );
        break;
      
      case UserType.APPSUMO:
        transitions.push(
          { to: UserType.ACTIVE_SUBSCRIBER, method: 'appsumo_migration', requirements: ['business_plan_selection', 'migration_consent'] }
        );
        break;
    }

    return transitions;
  }

  private static async validateUserTypeTransition(
    currentType: UserType,
    newType: UserType,
    organizationId: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    // Define valid transitions
    const validTransitions: Record<UserType, UserType[]> = {
      [UserType.FREE]: [UserType.TRIAL, UserType.ACTIVE_SUBSCRIBER],
      [UserType.TRIAL]: [UserType.FREE, UserType.ACTIVE_SUBSCRIBER],
      [UserType.CUSTOM_PLAN]: [UserType.ACTIVE_SUBSCRIBER],
      [UserType.APPSUMO]: [UserType.ACTIVE_SUBSCRIBER],
      [UserType.NEW_USER]: [UserType.FREE, UserType.TRIAL, UserType.ACTIVE_SUBSCRIBER],
      [UserType.ACTIVE_SUBSCRIBER]: [] // Usually no transitions back
    };

    const allowedTransitions = validTransitions[currentType] || [];
    
    if (!allowedTransitions.includes(newType)) {
      return {
        isValid: false,
        reason: `Transition from ${currentType} to ${newType} is not allowed`
      };
    }

    return { isValid: true };
  }

  private static async recordUserTypeChange(params: any): Promise<{ success: boolean; changeId?: string; message: string }> {
    try {
      const query = `
        INSERT INTO licensing_user_type_history (
          organization_team_id, previous_user_type, new_user_type, 
          change_reason, changed_by, admin_override, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;
      
      const result = await db.query(query, [
        params.organizationId,
        params.currentUserType,
        params.newUserType,
        params.reason,
        params.changedBy,
        params.adminOverride
      ]);

      // Update organization table
      await db.query(
        "UPDATE organizations SET user_type = $1, updated_at = NOW() WHERE id = $2",
        [params.newUserType, params.organizationId]
      );

      return {
        success: true,
        changeId: result.rows[0].id,
        message: "User type changed successfully"
      };
    } catch (error) {
      log_error(error);
      return {
        success: false,
        message: "Failed to record user type change"
      };
    }
  }

  private static async getUserTypeTransitionHistory(organizationId: string, limit: number): Promise<any[]> {
    const query = `
      SELECT 
        id, previous_user_type, new_user_type, change_reason,
        changed_by, admin_override, created_at,
        (SELECT name FROM users WHERE id = luth.changed_by) as changed_by_name
      FROM licensing_user_type_history luth
      WHERE organization_team_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    const result = await db.query(query, [organizationId, limit]);
    return result.rows;
  }

  private static async getUserTypeAnalytics(organizationId: string): Promise<any> {
    // Simplified analytics - would be more complex in real implementation
    return {
      averageTimeInType: 45, // days
      mostCommonProgression: 'free -> trial -> active_subscriber',
      conversionRates: {
        freeToTrial: 15,
        trialToSubscriber: 70,
        customToSubscriber: 25
      }
    };
  }

  private static async getCurrentTypeStatus(organizationId: string): Promise<any> {
    const userAnalytics = await PlanRecommendationService.generateRecommendations(organizationId);
    const userProgression = await UserAnalyticsService.analyzeUserTypeProgression(organizationId);

    return {
      currentType: userAnalytics.userAnalytics.userType,
      daysInCurrentType: userProgression.daysInCurrentType,
      progressionLikelihood: userProgression.progressionLikelihood,
      nextLikelyType: userProgression.nextLikelyUserType,
      stabilityScore: 100 - userProgression.progressionLikelihood // How stable they are in current type
    };
  }

  private static async checkActionEligibility(
    userType: UserType,
    action: string,
    organizationId: string
  ): Promise<{ eligible: boolean; reason?: string; requiredUserType?: UserType; upgradeOptions?: string[] }> {
    const actionRequirements: Record<string, { minType: UserType; requiredPlans: PlanTier[] }> = {
      'add_unlimited_users': { minType: UserType.ACTIVE_SUBSCRIBER, requiredPlans: [PlanTier.PRO_LARGE, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE] },
      'access_advanced_reporting': { minType: UserType.ACTIVE_SUBSCRIBER, requiredPlans: [PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE] },
      'use_client_portal': { minType: UserType.ACTIVE_SUBSCRIBER, requiredPlans: [PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE] },
      'sso_integration': { minType: UserType.ACTIVE_SUBSCRIBER, requiredPlans: [PlanTier.ENTERPRISE] },
      'priority_support': { minType: UserType.ACTIVE_SUBSCRIBER, requiredPlans: [PlanTier.BUSINESS_SMALL, PlanTier.BUSINESS_LARGE, PlanTier.ENTERPRISE] }
    };

    const requirement = actionRequirements[action];
    
    if (!requirement) {
      return { eligible: true }; // Unknown action, assume eligible
    }

    // Check user type eligibility
    const userTypeHierarchy = [UserType.FREE, UserType.TRIAL, UserType.CUSTOM_PLAN, UserType.APPSUMO, UserType.ACTIVE_SUBSCRIBER];
    const currentTypeIndex = userTypeHierarchy.indexOf(userType);
    const requiredTypeIndex = userTypeHierarchy.indexOf(requirement.minType);

    if (currentTypeIndex < requiredTypeIndex) {
      return {
        eligible: false,
        reason: `Requires ${requirement.minType} or higher`,
        requiredUserType: requirement.minType,
        upgradeOptions: requirement.requiredPlans
      };
    }

    return { eligible: true };
  }

  private static calculateOverallEligibilityScore(eligibilityResults: any[]): number {
    const eligibleCount = eligibilityResults.filter(r => r.eligible).length;
    return Math.round((eligibleCount / eligibilityResults.length) * 100);
  }

  private static getRecommendedActions(eligibilityResults: any[], currentUserType: UserType): string[] {
    const ineligibleActions = eligibilityResults.filter(r => !r.eligible);
    const recommendations = [];

    if (ineligibleActions.length > 0) {
      const mostCommonRequirement = this.findMostCommonRequirement(ineligibleActions);
      recommendations.push(`Consider upgrading to ${mostCommonRequirement} to unlock more features`);
    }

    if (currentUserType === UserType.TRIAL) {
      recommendations.push('Convert trial to paid subscription to retain access');
    }

    if (currentUserType === UserType.FREE) {
      recommendations.push('Upgrade to Pro or Business plan for advanced features');
    }

    return recommendations;
  }

  private static findMostCommonRequirement(ineligibleActions: any[]): string {
    const requirements = ineligibleActions.map(a => a.requiredUserType).filter(r => r);
    const counts = requirements.reduce((acc, req) => {
      acc[req] = (acc[req] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }
}