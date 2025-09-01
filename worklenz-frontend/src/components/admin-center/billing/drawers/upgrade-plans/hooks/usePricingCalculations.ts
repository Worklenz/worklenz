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

      if (teamSize <= TEAM_SIZE_THRESHOLD) {
        if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          const perUserMonthlyPrice = parseFloat(pricingData.pro_small.monthly_price || '0');
          finalPrice = perUserMonthlyPrice * teamSize;
        } else if (
          planType === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          const perUserMonthlyPrice = parseFloat(pricingData.business_small.monthly_price || '0');
          finalPrice = perUserMonthlyPrice * teamSize;
        } else if (planType === 'enterprise') {
          finalPrice = parseFloat(pricingData.enterprise.monthly_price || '0');
          if (!finalPrice && pricingData.enterprise.annual_price) {
            finalPrice = parseFloat(pricingData.enterprise.annual_price);
          }
        } else {
          const planData = planType === 'pro' ? pricingData.pro : pricingData.business;
          const basePrice = parseFloat(planData.monthly_price || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.additional_user_price || '0');
          finalPrice = basePrice + extraUserCost;
        }
      } else {
        let planData;
        if (planType === 'pro') {
          planData = pricingData.pro;
        } else if (planType === 'business') {
          planData = pricingData.business;
        } else {
          planData = pricingData.enterprise;
        }

        if (planType === 'enterprise') {
          finalPrice = parseFloat(planData.monthly_price || '0');
          if (!finalPrice && planData.annual_price) {
            finalPrice = parseFloat(planData.annual_price);
          }
        } else {
          const basePrice = parseFloat(planData.monthly_price || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost = extraUsers * parseFloat(planData.additional_user_price || '0');
          finalPrice = basePrice + extraUserCost;
        }
      }

      if (isAppSumoUser) {
        finalPrice = finalPrice * 0.5;
      }

      return finalPrice.toFixed(2);
    },
    [teamSize, pricingData, isAppSumoUser]
  );

  const calculateAnnualTotal = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      let finalPrice = 0;

      if (teamSize <= TEAM_SIZE_THRESHOLD) {
        if (planType === 'pro' && pricingData.pro_small?.pricing_model === 'per_user') {
          const perUserMonthlyIfAnnual = parseFloat(pricingData.pro_small.annual_price || '0');
          finalPrice = perUserMonthlyIfAnnual * 12 * teamSize;
        } else if (
          planType === 'business' &&
          pricingData.business_small?.pricing_model === 'per_user'
        ) {
          const perUserMonthlyIfAnnual = parseFloat(pricingData.business_small.annual_price || '0');
          finalPrice = perUserMonthlyIfAnnual * 12 * teamSize;
        } else if (planType === 'enterprise') {
          const annualTotal = parseFloat(pricingData.enterprise.annual_total || '0');
          if (annualTotal > 0) {
            finalPrice = annualTotal;
          } else {
            finalPrice = parseFloat(pricingData.enterprise.annual_price || '0') * 12;
          }
        } else {
          const planData = planType === 'pro' ? pricingData.pro : pricingData.business;
          const baseAnnualTotal = parseFloat(planData.annual_total || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost =
            extraUsers * parseFloat(planData.additional_user_price || '0') * 12;
          finalPrice = baseAnnualTotal + extraUserCost;
        }
      } else {
        let planData;
        if (planType === 'pro') {
          planData = pricingData.pro;
        } else if (planType === 'business') {
          planData = pricingData.business;
        } else {
          planData = pricingData.enterprise;
        }

        if (planType === 'enterprise') {
          const annualTotal = parseFloat(planData.annual_total || '0');
          if (annualTotal > 0) {
            finalPrice = annualTotal;
          } else {
            finalPrice = parseFloat(planData.annual_price || '0') * 12;
          }
        } else {
          const baseAnnualTotal = parseFloat(planData.annual_total || '0');
          const includedUsers = parseInt(planData.users_included) || 0;
          const extraUsers = Math.max(0, teamSize - includedUsers);
          const extraUserCost =
            extraUsers * parseFloat(planData.additional_user_price || '0') * 12;
          finalPrice = baseAnnualTotal + extraUserCost;
        }
      }

      if (isAppSumoUser) {
        finalPrice = finalPrice * 0.5;
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

      if (useSmallTeamPricing && planData.pricing_model === 'per_user') {
        return t('pricing-modal:pricing.perUser') + t('pricing-modal:pricing.perMonth');
      }
      return t('pricing-modal:pricing.perMonth');
    },
    [teamSize, pricingData, t]
  );

  const getEffectivePricingModel = useCallback(
    (planType: 'pro' | 'business' | 'enterprise') => {
      if (planType === 'enterprise') return 'base_plan';
      return teamSize <= TEAM_SIZE_THRESHOLD &&
        ((planType === 'pro' && pricingData.pro_small) ||
          (planType === 'business' && pricingData.business_small))
        ? 'per_user'
        : 'base_plan';
    },
    [teamSize, pricingData]
  );

  return {
    calculateMonthlyTotal,
    calculateAnnualTotal,
    getPriceLabel,
    getEffectivePricingModel,
  };
};