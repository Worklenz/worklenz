import React from 'react';
import { Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

interface PlanRibbonProps {
  isSelected: boolean;
  planType: 'free' | 'pro' | 'business' | 'enterprise';
  isAppSumoUser?: boolean;
  themeMode?: 'light' | 'dark';
  teamSize?: number;
  billingFrequency?: 'monthly' | 'annual';
  calculateTotalCostForPlan?: (
    planType: 'pro' | 'business' | 'enterprise',
    teamSize: number,
    isAnnual: boolean
  ) => number;
}

export const PlanRibbon: React.FC<PlanRibbonProps> = ({
  isSelected,
  planType,
  isAppSumoUser = false,
  themeMode = 'light',
  teamSize = 1,
  billingFrequency = 'annual',
  calculateTotalCostForPlan,
}) => {
  const { t } = useTranslation(['pricing-modal']);

  // Show ribbon for selected plans OR for the recommended plan based on cost

  // Determine ribbon text and styling based on plan type and user type
  const getRibbonConfig = () => {
    if (isAppSumoUser) {
      switch (planType) {
        case 'business':
          return {
            text: t('pricing-modal:ribbon.appsumoSpecial', 'AppSumo Special'),
            backgroundColor: '#ff6b35',
            textColor: '#ffffff',
          };
        case 'enterprise':
          return {
            text: t('pricing-modal:ribbon.appsumoSpecial', 'AppSumo Special'),
            backgroundColor: '#ff6b35',
            textColor: '#ffffff',
          };
        default:
          return null;
      }
    }

    // Cost-based recommendation logic
    let isRecommended = false;

    if (calculateTotalCostForPlan && (planType === 'pro' || planType === 'business')) {
      const isAnnual = billingFrequency === 'annual';
      const proCost = calculateTotalCostForPlan('pro', teamSize, isAnnual);
      const businessCost = calculateTotalCostForPlan('business', teamSize, isAnnual);

      // Determine which plan is cheaper and mark it as recommended
      if (planType === 'pro' && proCost < businessCost) {
        isRecommended = true;
      } else if (planType === 'business' && businessCost < proCost) {
        isRecommended = true;
      }
    }

    // Show ribbon only if this plan is recommended
    if (!isRecommended) {
      return null;
    }

    switch (planType) {
      case 'pro':
        return isRecommended
          ? {
              text: t('pricing-modal:ribbon.recommended', 'Recommended'),
              backgroundColor: themeMode === 'dark' ? '#1890ff' : '#1890ff',
              textColor: '#ffffff',
            }
          : null;
      case 'business':
        return isRecommended
          ? {
              text: t('pricing-modal:ribbon.recommended', 'Recommended'),
              backgroundColor: themeMode === 'dark' ? '#52c41a' : '#52c41a',
              textColor: '#ffffff',
            }
          : null;
      case 'enterprise':
        return null;
      default:
        return null;
    }
  };

  const ribbonConfig = getRibbonConfig();

  if (!ribbonConfig || !ribbonConfig.text) return null;

  return (
    <div
      className="plan-ribbon"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: ribbonConfig.backgroundColor,
        color: ribbonConfig.textColor,
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        zIndex: 10,
        borderRadius: '0 8px 0 8px',
        boxShadow:
          themeMode === 'dark' ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
        transform: 'translate(8px, -8px)',
        minWidth: '80px',
        textAlign: 'center',
      }}
    >
      <Typography.Text
        style={{
          color: ribbonConfig.textColor,
          fontSize: '12px',
          fontWeight: 600,
          margin: 0,
        }}
      >
        {ribbonConfig.text}
      </Typography.Text>
    </div>
  );
};
