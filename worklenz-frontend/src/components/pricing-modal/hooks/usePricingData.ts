import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import { IPricingOption, IBillingAccountInfo } from '@/types/admin-center/admin-center.types';
import {
  UserPersonalization,
  PricingCalculation,
  PricingModel,
  BillingCycle,
} from '../PricingModal';

interface UsePricingDataProps {
  organizationId?: string;
  initialTeamSize?: number;
  initialPricingModel?: PricingModel;
  initialBillingCycle?: BillingCycle;
}

interface UsePricingDataReturn {
  // Data
  currentUser: UserPersonalization | null;
  availablePlans: IPricingOption[];
  recommendations: any[];

  // Loading states
  loading: boolean;
  calculating: boolean;

  // Actions
  calculatePricing: (
    planId: string,
    teamSize: number,
    model: PricingModel,
    cycle: BillingCycle
  ) => Promise<PricingCalculation | null>;
  getMigrationEligibility: () => Promise<any>;
  getAppSumoStatus: () => Promise<any>;
  getUserTypeInfo: () => Promise<any>;

  // Error handling
  error: string | null;
  clearError: () => void;
}

// API Service Functions
const apiService = {
  // Migration APIs
  async getMigrationEligibility(organizationId: string) {
    const response = await fetch(`/api/migration/organizations/${organizationId}/eligibility`);
    if (!response.ok) throw new Error('Failed to fetch migration eligibility');
    return response.json();
  },

  async getMigrationPreview(organizationId: string, targetPlan: string, billingCycle: string) {
    const response = await fetch(
      `/api/migration/organizations/${organizationId}/preview?targetPlan=${targetPlan}&billingCycle=${billingCycle}`
    );
    if (!response.ok) throw new Error('Failed to fetch migration preview');
    return response.json();
  },

  // User Type APIs
  async getUserType() {
    const response = await fetch('/api/users/type');
    if (!response.ok) throw new Error('Failed to fetch user type');
    return response.json();
  },

  async getUserTypeHistory() {
    const response = await fetch('/api/users/type/history');
    if (!response.ok) throw new Error('Failed to fetch user type history');
    return response.json();
  },

  async getLegacyPlan() {
    const response = await fetch('/api/users/legacy-plan');
    if (!response.ok) throw new Error('Failed to fetch legacy plan');
    return response.json();
  },

  // Plan APIs
  async getAvailablePlans() {
    const response = await fetch('/api/plans/');
    if (!response.ok) throw new Error('Failed to fetch available plans');
    return response.json();
  },

  async calculatePlanPricing(
    planId: string,
    userCount: number,
    billingCycle: string,
    discountCodes: string[] = []
  ) {
    const response = await fetch('/api/plans/calculate-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        userCount,
        billingCycle,
        discountCodes,
      }),
    });
    if (!response.ok) throw new Error('Failed to calculate pricing');
    return response.json();
  },

  // Plan Recommendation APIs
  async getPlanRecommendations(organizationId: string) {
    const response = await fetch(`/api/plan-recommendations/organizations/${organizationId}`);
    if (!response.ok) throw new Error('Failed to fetch plan recommendations');
    return response.json();
  },

  async getCostBenefitAnalysis(organizationId: string, targetPlan: string) {
    const response = await fetch(
      `/api/plan-recommendations/organizations/${organizationId}/cost-benefit?targetPlan=${targetPlan}&analysisDepth=comprehensive`
    );
    if (!response.ok) throw new Error('Failed to fetch cost-benefit analysis');
    return response.json();
  },

  // AppSumo APIs
  async getAppSumoStatus(organizationId: string) {
    const response = await fetch(
      `/api/plan-recommendations/organizations/${organizationId}/appsumo`
    );
    if (!response.ok) throw new Error('Failed to fetch AppSumo status');
    return response.json();
  },

  async getAppSumoCountdown(organizationId: string) {
    const response = await fetch(
      `/api/plan-recommendations/organizations/${organizationId}/appsumo-countdown`
    );
    if (!response.ok) throw new Error('Failed to fetch AppSumo countdown');
    return response.json();
  },

  // Subscription APIs
  async getCurrentSubscription() {
    const response = await fetch('/api/subscriptions/current');
    if (!response.ok) throw new Error('Failed to fetch current subscription');
    return response.json();
  },

  async validateAction(action: string, resourceCount: number, userId: string) {
    const response = await fetch('/api/subscriptions/validate-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        resourceCount,
        userId,
      }),
    });
    if (!response.ok) throw new Error('Failed to validate action');
    return response.json();
  },
};

export const usePricingData = ({
  organizationId,
  initialTeamSize = 5,
  initialPricingModel = 'BASE_PLAN',
  initialBillingCycle = 'YEARLY',
}: UsePricingDataProps = {}): UsePricingDataReturn => {
  const { t } = useTranslation(['pricing', 'common']);

  // State
  const [currentUser, setCurrentUser] = useState<UserPersonalization | null>(null);
  const [availablePlans, setAvailablePlans] = useState<IPricingOption[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Error handling
  const clearError = useCallback(() => setError(null), []);

  const handleError = useCallback((error: Error, context: string) => {
    console.error(`Error in ${context}:`, error);
    setError(error.message);
    message.error(`${context}: ${error.message}`);
  }, []);

  // Fetch user personalization data
  const fetchUserPersonalization = useCallback(async () => {
    if (!organizationId) return;

    try {
      const [userType, currentSubscription] = await Promise.all([
        apiService.getUserType(),
        apiService.getCurrentSubscription().catch(() => null), // May not exist for free users
      ]);

      let personalization: UserPersonalization = {
        userType: userType.type || 'free',
        currentPlan: currentSubscription?.plan_id,
      };

      // Fetch additional data based on user type
      switch (userType.type) {
        case 'trial':
          if (userType.trialExpiry) {
            const expiryDate = new Date(userType.trialExpiry);
            const today = new Date();
            const diffTime = expiryDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            personalization.trialDaysRemaining = Math.max(0, diffDays);
          }
          break;

        case 'appsumo':
          try {
            const appSumoStatus = await apiService.getAppSumoStatus(organizationId);
            if (appSumoStatus.discountExpiry) {
              personalization.appSumoDiscountExpiry = new Date(appSumoStatus.discountExpiry);
            }
          } catch (error) {
            console.warn('Failed to fetch AppSumo status:', error);
          }
          break;

        case 'custom':
          try {
            const legacyPlan = await apiService.getLegacyPlan();
            personalization.customPlanFeatures = legacyPlan.features || [];
          } catch (error) {
            console.warn('Failed to fetch legacy plan:', error);
          }
          break;
      }

      // Get usage metrics if available
      if (currentSubscription) {
        personalization.usageMetrics = {
          projects: currentSubscription.projects_count || 0,
          users: currentSubscription.actual_users || 0,
          storage: currentSubscription.usedStorage || 0,
        };
      }

      setCurrentUser(personalization);
    } catch (error) {
      handleError(error as Error, 'Failed to fetch user personalization');
    }
  }, [organizationId, handleError]);

  // Fetch available plans
  const fetchAvailablePlans = useCallback(async () => {
    try {
      const plans = await apiService.getAvailablePlans();
      setAvailablePlans(plans);
    } catch (error) {
      handleError(error as Error, 'Failed to fetch available plans');
    }
  }, [handleError]);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    if (!organizationId) return;

    try {
      const recommendations = await apiService.getPlanRecommendations(organizationId);
      setRecommendations(recommendations);
    } catch (error) {
      console.warn('Failed to fetch recommendations:', error);
      // Not critical, so don't show error to user
    }
  }, [organizationId]);

  // Calculate pricing for a specific plan
  const calculatePricing = useCallback(
    async (
      planId: string,
      teamSize: number,
      model: PricingModel,
      cycle: BillingCycle
    ): Promise<PricingCalculation | null> => {
      setCalculating(true);
      clearError();

      try {
        const billingCycle = cycle.toLowerCase();
        const discountCodes: string[] = [];

        // Add discount codes based on user type
        if (currentUser?.userType === 'appsumo') {
          discountCodes.push('APPSUMO50');
        }

        const pricingResult = await apiService.calculatePlanPricing(
          planId,
          teamSize,
          billingCycle,
          discountCodes
        );

        const calculation: PricingCalculation = {
          model,
          cycle,
          teamSize,
          planId,
          basePrice: pricingResult.basePrice || 0,
          additionalUsersCost: pricingResult.additionalUsersCost || 0,
          totalCost: pricingResult.totalCost || 0,
        };

        // Add annual savings if applicable
        if (cycle === 'YEARLY' && pricingResult.annualSavings) {
          calculation.annualSavings = pricingResult.annualSavings;
        }

        // Add discount information if applicable
        if (pricingResult.discountApplied) {
          calculation.discountApplied = {
            type: pricingResult.discountApplied.type,
            percentage: pricingResult.discountApplied.percentage,
            amount: pricingResult.discountApplied.amount,
          };
        }

        return calculation;
      } catch (error) {
        handleError(error as Error, 'Failed to calculate pricing');
        return null;
      } finally {
        setCalculating(false);
      }
    },
    [currentUser, handleError, clearError]
  );

  // Migration eligibility
  const getMigrationEligibility = useCallback(async () => {
    if (!organizationId) throw new Error('Organization ID required');
    return apiService.getMigrationEligibility(organizationId);
  }, [organizationId]);

  // AppSumo status
  const getAppSumoStatus = useCallback(async () => {
    if (!organizationId) throw new Error('Organization ID required');
    return apiService.getAppSumoStatus(organizationId);
  }, [organizationId]);

  // User type info
  const getUserTypeInfo = useCallback(async () => {
    return apiService.getUserType();
  }, []);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      clearError();

      try {
        await Promise.all([
          fetchUserPersonalization(),
          fetchAvailablePlans(),
          fetchRecommendations(),
        ]);
      } catch (error) {
        console.error('Failed to initialize pricing data:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [fetchUserPersonalization, fetchAvailablePlans, fetchRecommendations, clearError]);

  return {
    // Data
    currentUser,
    availablePlans,
    recommendations,

    // Loading states
    loading,
    calculating,

    // Actions
    calculatePricing,
    getMigrationEligibility,
    getAppSumoStatus,
    getUserTypeInfo,

    // Error handling
    error,
    clearError,
  };
};
