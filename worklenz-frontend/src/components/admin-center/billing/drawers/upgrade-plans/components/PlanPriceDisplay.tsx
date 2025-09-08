import { Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { PlanPriceDisplayProps } from '../types';
import { PRICE_FONT_SIZE, APPSUMO_DISCOUNT_COLOR } from '../constants';

export const PlanPriceDisplay: React.FC<PlanPriceDisplayProps> = ({ 
  monthlyPrice, 
  annualPrice, 
  perUserMonthlyPrice,
  perUserAnnualPrice,
  isSmallTeam,
  billingFrequency,
  label, 
  subtitle, 
  isAppSumoUser 
}) => {
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  
  // Theme-aware colors
  const textColor = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)';
  const labelColor = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)';
  
  // Determine which pricing to show based on billing frequency
  const isAnnual = billingFrequency === 'annual';
  
  return (
  <div style={{ textAlign: 'center', marginBottom: 24 }}>
    {/* Show per-user pricing prominently whenever per-user pricing exists */}
    {perUserMonthlyPrice ? (
      <>
        <Typography.Title level={1} style={{ fontSize: PRICE_FONT_SIZE, margin: 0 }}>
          ${isAnnual ? perUserAnnualPrice : perUserMonthlyPrice}
        </Typography.Title>
        <Typography.Text style={{ fontSize: '16px', marginBottom: '8px', display: 'block', color: labelColor }}>
          {t('pricing-modal:pricing.perUser')} {t('pricing-modal:pricing.perMonth')}
        </Typography.Text>
        
        {/* Show total price below per-user price */}
        <Typography.Text style={{ fontSize: '18px', fontWeight: 'bold', color: labelColor, display: 'block', marginBottom: '4px' }}>
          ${isAnnual ? annualPrice : monthlyPrice} {isAnnual ? t('pricing-modal:billing.perYear', '/year') : t('pricing-modal:billing.perMonth', '/month')}
        </Typography.Text>
        
        {/* Show billing frequency info */}
        <Typography.Text style={{ fontSize: '14px', color: textColor, display: 'block' }}>
          {isAnnual 
            ? t('pricing-modal:billing.billedAnnually', 'billed annually') 
            : t('pricing-modal:billing.billedMonthly', 'billed monthly')}
        </Typography.Text>
      </>
    ) : (
      <>
        {/* For larger teams: Show total pricing in bigger text */}
        <Typography.Title level={1} style={{ fontSize: PRICE_FONT_SIZE, margin: 0 }}>
          ${isAnnual ? annualPrice : monthlyPrice}
        </Typography.Title>
        <Typography.Text style={{ fontSize: '16px', marginBottom: '8px', display: 'block', color: labelColor }}>
          {label}
        </Typography.Text>
        
        {/* Show billing frequency info */}
        <Typography.Text style={{ fontSize: '14px', color: textColor, display: 'block' }}>
          {isAnnual 
            ? t('pricing-modal:billing.billedAnnually', 'billed annually') 
            : t('pricing-modal:billing.billedMonthly', 'billed monthly')}
        </Typography.Text>
      </>
    )}
    
    {subtitle}
    {isAppSumoUser && (
      <span
        style={{
          color: APPSUMO_DISCOUNT_COLOR,
          fontWeight: 'bold',
          display: 'block',
          fontSize: '12px',
          marginTop: 4,
        }}
      >
{t('pricing-modal:appsumo.discountApplied', '50% AppSumo Discount Applied')}
      </span>
    )}
  </div>
);
};