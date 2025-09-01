import { Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { PlanPriceDisplayProps } from '../types';
import { PRICE_FONT_SIZE, APPSUMO_DISCOUNT_COLOR } from '../constants';

export const PlanPriceDisplay: React.FC<PlanPriceDisplayProps> = ({ 
  price, 
  label, 
  subtitle, 
  isAppSumoUser 
}) => {
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);
  
  return (
  <div style={{ textAlign: 'center', marginBottom: 24 }}>
    <Typography.Title level={1} style={{ fontSize: PRICE_FONT_SIZE, margin: 0 }}>
      ${price}
    </Typography.Title>
    <Typography.Text>{label}</Typography.Text>
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