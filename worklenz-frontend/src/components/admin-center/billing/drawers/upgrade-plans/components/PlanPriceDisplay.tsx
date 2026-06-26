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
  isAppSumoUser,
  originalMonthlyPrice,
  originalAnnualPrice,
}) => {
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Theme-aware colors
  const textColor = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)';
  const labelColor = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)';
  const strikethroughColor =
    themeMode === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)';

  // Determine which pricing to show based on billing frequency
  const isAnnual = billingFrequency === 'annual';
  const parseAmount = (v?: string | null) => {
    if (!v && v !== '0') return undefined;
    const cleaned = String(v).replace(/[^0-9.]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  };
  const monthlyNumeric = parseAmount(perUserMonthlyPrice ?? monthlyPrice);
  const annualNumeric = parseAmount(annualPrice);
  const computedAnnualMonthly =
    annualNumeric !== undefined ? (annualNumeric / 12).toFixed(2) : undefined;
  const computedAnnualFromMonthly =
    monthlyNumeric !== undefined ? (monthlyNumeric * 12).toFixed(2) : undefined;
  const displayedAnnualTotal = isAnnual
    ? annualNumeric !== undefined
      ? annualNumeric.toFixed(2)
      : computedAnnualFromMonthly
    : (computedAnnualFromMonthly ??
      (annualNumeric !== undefined ? annualNumeric.toFixed(2) : undefined));

  // Compute savings percentage for annual vs monthly*12
  const savingsPercent = (() => {
    if (monthlyNumeric === undefined) return undefined;
    const baseline = monthlyNumeric * 12;
    const annualTotal = annualNumeric !== undefined ? annualNumeric : baseline;
    if (!baseline || annualTotal >= baseline) return undefined;
    const pct = Math.round(((baseline - annualTotal) / baseline) * 100);
    return pct > 0 ? pct : undefined;
  })();

  return (
    <div style={{ textAlign: 'center', marginBottom: 12 }}>
      {perUserMonthlyPrice ? (
        // Per-user pricing display
        <>
          {isAnnual ? (
            // Annual billing - show monthly rate calculated from annual price
            <>
              {/* Show strikethrough original price for AppSumo users */}
              {isAppSumoUser && originalAnnualPrice && (
                <Typography.Text
                  style={{
                    fontSize: '14px',
                    color: strikethroughColor,
                    textDecoration: 'line-through',
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  ${(parseFloat(originalAnnualPrice) / 12).toFixed(2)}{' '}
                  {t('pricing-modal:pricing.perUser')}{' '}
                  {t('pricing-modal:billing.perMonth', '/month')}
                </Typography.Text>
              )}

              <Typography.Title level={2} style={{ fontSize: '28px', margin: 0, lineHeight: 1.2 }}>
                ${perUserAnnualPrice || (parseFloat(displayedAnnualTotal) / 12).toFixed(2)}
              </Typography.Title>
              <Typography.Text
                style={{
                  fontSize: '14px',
                  marginBottom: '4px',
                  display: 'block',
                  color: labelColor,
                }}
              >
                {t('pricing-modal:pricing.perUser')} {t('pricing-modal:billing.perMonth', '/month')}
              </Typography.Text>
              <Typography.Text style={{ fontSize: '12px', color: textColor, display: 'block' }}>
                {t('pricing-modal:billing.billedAnnually', 'billed annually')}
              </Typography.Text>
            </>
          ) : (
            // Monthly billing - show monthly pricing only
            <>
              {/* Show strikethrough original monthly price for AppSumo users */}
              {isAppSumoUser && originalMonthlyPrice && (
                <Typography.Text
                  style={{
                    fontSize: '14px',
                    color: strikethroughColor,
                    textDecoration: 'line-through',
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  ${originalMonthlyPrice} {t('pricing-modal:pricing.perUser')}{' '}
                  {t('pricing-modal:billing.perMonth', '/month')}
                </Typography.Text>
              )}

              <Typography.Title level={2} style={{ fontSize: '28px', margin: 0, lineHeight: 1.2 }}>
                ${monthlyNumeric !== undefined ? monthlyNumeric.toFixed(2) : perUserMonthlyPrice}
              </Typography.Title>
              <Typography.Text
                style={{
                  fontSize: '14px',
                  marginBottom: '4px',
                  display: 'block',
                  color: labelColor,
                }}
              >
                {t('pricing-modal:pricing.perUser')} {t('pricing-modal:billing.perMonth', '/month')}
              </Typography.Text>
            </>
          )}
        </>
      ) : (
        // Base plan pricing display
        <>
          {isAnnual ? (
            // Annual billing - show monthly rate calculated from annual price
            <>
              {/* Show strikethrough original price for AppSumo users */}
              {isAppSumoUser && originalAnnualPrice && (
                <Typography.Text
                  style={{
                    fontSize: '14px',
                    color: strikethroughColor,
                    textDecoration: 'line-through',
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  ${(parseFloat(originalAnnualPrice) / 12).toFixed(2)}{' '}
                  {t('pricing-modal:billing.perMonth', '/month')}
                </Typography.Text>
              )}

              <Typography.Title level={2} style={{ fontSize: '28px', margin: 0, lineHeight: 1.2 }}>
                ${(parseFloat(displayedAnnualTotal) / 12).toFixed(2)}
              </Typography.Title>
              <Typography.Text
                style={{
                  fontSize: '14px',
                  marginBottom: '4px',
                  display: 'block',
                  color: labelColor,
                }}
              >
                {t('pricing-modal:billing.perMonth', '/month')}
              </Typography.Text>
              <Typography.Text style={{ fontSize: '12px', color: textColor, display: 'block' }}>
                {t('pricing-modal:billing.billedAnnually', 'billed annually')}
              </Typography.Text>
            </>
          ) : (
            // Monthly billing - show monthly pricing only
            <>
              {/* Show strikethrough original monthly price for AppSumo users */}
              {isAppSumoUser && originalMonthlyPrice && (
                <Typography.Text
                  style={{
                    fontSize: '14px',
                    color: strikethroughColor,
                    textDecoration: 'line-through',
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  ${originalMonthlyPrice} {t('pricing-modal:billing.perMonth', '/month')}
                </Typography.Text>
              )}

              <Typography.Title level={2} style={{ fontSize: '28px', margin: 0, lineHeight: 1.2 }}>
                ${monthlyNumeric !== undefined ? monthlyNumeric.toFixed(2) : monthlyPrice}
              </Typography.Title>
              <Typography.Text
                style={{
                  fontSize: '14px',
                  marginBottom: '4px',
                  display: 'block',
                  color: labelColor,
                }}
              >
                {t('pricing-modal:billing.perMonth', '/month')}
              </Typography.Text>
            </>
          )}
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
          {t('pricing-modal:appsumo.discountApplied', '70% AppSumo Discount Applied')}
        </span>
      )}
    </div>
  );
};
