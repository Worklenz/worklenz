import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PricingData } from '../types';
import { TEAM_SIZE_THRESHOLD } from '../constants';

export const usePricingCalculations = (
  teamSize: number,
  pricingData: PricingData,
  isAppSumoUser: boolean
) => {
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);

  const calculateMonthlyTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;

      // Get the appropriate plan data
      let planData;
      if (planType === 'pro') {
        planData = pricingData.pro;
      } else if (planType === 'business') {
        planData = pricingData.business;
      } else {
        planData = pricingData.enterprise;
      }

      // Handle AppSumo promo plans first (check pricing_model regardless of isAppSumoUser flag)
      // This ensures correct pricing even if isAppSumoUser flag has issues
      if (planData?.pricing_model?.startsWith('promo_')) {
        finalPrice = parseFloat(planData.monthly_base_price || '0');
        if (!finalPrice && planData.annual_base_price) {
          finalPrice = parseFloat(planData.annual_base_price) / 12;
        }
        return finalPrice.toFixed(2);
      }

      // Regular pricing logic for non-AppSumo users
      if (teamSize <= TEAM_SIZE_THRESHOLD) {
        if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          const perUserMonthlyPrice = parseFloat(
            pricingData.pro_small.monthly_per_user_price || '0'
          );
          finalPrice = perUserMonthlyPrice * teamSize;
        } else if (
          planType === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          const perUserMonthlyPrice = parseFloat(
            pricingData.business_small.monthly_per_user_price || '0'
          );
          finalPrice = perUserMonthlyPrice * teamSize;
        } else if (planType === 'enterprise') {
          finalPrice = parseFloat(pricingData.enterprise.monthly_base_price || '0');
          if (!finalPrice && pricingData.enterprise.annual_base_price) {
            finalPrice = parseFloat(pricingData.enterprise.annual_base_price) / 12;
          }
        } else {
          const basePrice = parseFloat(planData.monthly_base_price || '0');
          const includedUsers = parseInt(planData.included_users) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.monthly_per_user_price || '0');
          finalPrice = basePrice + extraUserCost;
        }
      } else {
        if (planType === 'enterprise') {
          finalPrice = parseFloat(planData.monthly_base_price || '0');
          if (!finalPrice && planData.annual_base_price) {
            finalPrice = parseFloat(planData.annual_base_price) / 12;
          }
        } else {
          const basePrice = parseFloat(planData.monthly_base_price || '0');
          const includedUsers = parseInt(planData.included_users) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.monthly_per_user_price || '0');
          finalPrice = basePrice + extraUserCost;
        }
      }

      return finalPrice.toFixed(2);
    },
    [teamSize, pricingData, isAppSumoUser]
  );

  const calculateAnnualTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;

      // Get the appropriate plan data
      let planData;
      if (planType === 'pro') {
        planData = pricingData.pro;
      } else if (planType === 'business') {
        planData = pricingData.business;
      } else {
        planData = pricingData.enterprise;
      }

      // Handle AppSumo promo plans first (check pricing_model regardless of isAppSumoUser flag)
      // This ensures correct pricing even if isAppSumoUser flag has issues
      if (planData?.pricing_model?.startsWith('promo_')) {
        finalPrice = parseFloat(planData.annual_base_price || '0');
        if (!finalPrice && planData.monthly_base_price) {
          finalPrice = parseFloat(planData.monthly_base_price) * 12;
        }
        return finalPrice.toFixed(2);
      }

      // Regular pricing logic for non-AppSumo users
      if (teamSize <= TEAM_SIZE_THRESHOLD) {
        if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          // annual_per_user_price is already the monthly rate when paid annually, so multiply by 12
          const perUserMonthlyWhenAnnual = parseFloat(
            pricingData.pro_small.annual_per_user_price || '0'
          );
          finalPrice = perUserMonthlyWhenAnnual * 12 * teamSize;
        } else if (
          planType === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          // annual_per_user_price is already the monthly rate when paid annually, so multiply by 12
          const perUserMonthlyWhenAnnual = parseFloat(
            pricingData.business_small.annual_per_user_price || '0'
          );
          finalPrice = perUserMonthlyWhenAnnual * 12 * teamSize;
        } else if (planType === 'enterprise') {
          finalPrice = parseFloat(pricingData.enterprise.annual_base_price || '0');
        } else {
          const baseAnnualPrice = parseFloat(planData.annual_base_price || '0');
          const includedUsers = parseInt(planData.included_users) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.annual_per_user_price || '0') * 12;
          finalPrice = baseAnnualPrice + extraUserCost;
        }
      } else {
        if (planType === 'enterprise') {
          finalPrice = parseFloat(planData.annual_base_price || '0');
        } else {
          const baseAnnualPrice = parseFloat(planData.annual_base_price || '0');
          const includedUsers = parseInt(planData.included_users) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.annual_per_user_price || '0') * 12;
          finalPrice = baseAnnualPrice + extraUserCost;
        }
      }

      return finalPrice.toFixed(2);
    },
    [teamSize, pricingData, isAppSumoUser]
  );

  const getPriceLabel = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      const useSmallTeamPricing = teamSize <= TEAM_SIZE_THRESHOLD;

      let planData;
      if (planType === 'pro') {
        planData =
          useSmallTeamPricing && pricingData.pro_small ? pricingData.pro_small : pricingData.pro;
      } else if (planType === 'business') {
        planData =
          useSmallTeamPricing && pricingData.business_small
            ? pricingData.business_small
            : pricingData.business;
      } else {
        planData = pricingData.enterprise;
      }

      // Handle AppSumo promo plans (check pricing_model regardless of isAppSumoUser flag)
      if (planData?.pricing_model?.startsWith('promo_')) {
        if (planData.pricing_model === 'promo_unlimited') {
          return t('pricing-modal:pricing.perMonth');
        }
        return t('pricing-modal:pricing.perMonth');
      }

      if (useSmallTeamPricing && planData.pricing_model === 'per_user') {
        return t('pricing-modal:pricing.perUser') + t('pricing-modal:pricing.perMonth');
      }
      return t('pricing-modal:pricing.perMonth');
    },
    [teamSize, pricingData, isAppSumoUser, t]
  );

  const getEffectivePricingModel = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      if (planType === 'enterprise') return 'base_plan';

      // Check if small plans exist and have valid plan IDs (consistent with plan selection logic)
      const hasValidProSmall =
        pricingData.pro_small &&
        (pricingData.pro_small.monthly_plan_id || pricingData.pro_small.annual_plan_id);
      const hasValidBusinessSmall =
        pricingData.business_small &&
        (pricingData.business_small.monthly_plan_id || pricingData.business_small.annual_plan_id);

      return teamSize <= TEAM_SIZE_THRESHOLD &&
        ((planType === 'pro' && hasValidProSmall) ||
          (planType === 'business' && hasValidBusinessSmall))
        ? 'per_user'
        : 'base_plan';
    },
    [teamSize, pricingData]
  );

  const getPerUserMonthlyPrice = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      if (teamSize > TEAM_SIZE_THRESHOLD) return null;

      if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
        return pricingData.pro_small.monthly_per_user_price || '0';
      } else if (
        planType === 'business' &&
        pricingData.business_small?.pricing_model === 'per_user'
      ) {
        return pricingData.business_small.monthly_per_user_price || '0';
      }

      return null;
    },
    [teamSize, pricingData]
  );

  const getPerUserAnnualPrice = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      if (teamSize > TEAM_SIZE_THRESHOLD) return null;

      if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
        return pricingData.pro_small.annual_per_user_price || '0';
      } else if (
        planType === 'business' &&
        pricingData.business_small?.pricing_model === 'per_user'
      ) {
        return pricingData.business_small.annual_per_user_price || '0';
      }

      return null;
    },
    [teamSize, pricingData]
  );

  // Calculate original pricing (before 70% AppSumo discount) for strikethrough display
  const calculateOriginalMonthlyTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      // Only show original price for AppSumo promo plans
      const planData =
        planType === 'pro'
          ? pricingData.pro
          : planType === 'business'
            ? pricingData.business
            : pricingData.enterprise;

      if (!planData?.pricing_model?.startsWith('promo_')) {
        return null;
      }

      // AppSumo prices from API are already the FINAL discounted prices (70% off already applied)
      // To show the original price, divide by 0.3 (30% remaining) to reverse the 70% discount
      // Formula: discountedPrice = originalPrice * 0.3, so originalPrice = discountedPrice / 0.3
      const appSumoPrice = parseFloat(calculateMonthlyTotal(planType));
      const originalPrice = appSumoPrice / 0.3;
      return originalPrice.toFixed(2);
    },
    [calculateMonthlyTotal, pricingData]
  );

  const calculateOriginalAnnualTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      // Only show original price for AppSumo promo plans
      const planData =
        planType === 'pro'
          ? pricingData.pro
          : planType === 'business'
            ? pricingData.business
            : pricingData.enterprise;

      if (!planData?.pricing_model?.startsWith('promo_')) {
        return null;
      }

      // AppSumo prices from API are already the FINAL discounted prices (70% off already applied)
      // To show the original price, divide by 0.3 (30% remaining) to reverse the 70% discount
      // Formula: discountedPrice = originalPrice * 0.3, so originalPrice = discountedPrice / 0.3
      const appSumoPrice = parseFloat(calculateAnnualTotal(planType));
      const originalPrice = appSumoPrice / 0.3;
      return originalPrice.toFixed(2);
    },
    [calculateAnnualTotal, pricingData]
  );

  return {
    calculateMonthlyTotal,
    calculateAnnualTotal,
    getPriceLabel,
    getEffectivePricingModel,
    getPerUserMonthlyPrice,
    getPerUserAnnualPrice,
    calculateOriginalMonthlyTotal,
    calculateOriginalAnnualTotal,
  };
};
