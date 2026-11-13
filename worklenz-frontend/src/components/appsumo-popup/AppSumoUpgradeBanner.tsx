import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChartOutlined,
  TeamOutlined,
  DollarOutlined,
  TableOutlined,
  PaperClipOutlined,
  MessageOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import {
  APPSUMO_PROMO_DEFAULT_BILLING,
  APPSUMO_PROMO_PRICING,
  type AppSumoBillingPeriod,
} from '@/config/appsumo-promo.config';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { MixpanelBillingEvents } from '@/types/mixpanel-events.types';
import './AppSumoPopup.css';

interface AppSumoUpgradeBannerProps {
  sourceComponent: string;
  showClose?: boolean;
  onClose?: () => void;
  trackView?: boolean;
  className?: string;
  onBeforeUpgrade?: () => void;
}

interface FeatureItem {
  key: string;
  icon: ReactNode;
  wide?: boolean;
}

const FEATURES: FeatureItem[] = [
  { key: 'advancedReporting', icon: <BarChartOutlined />, wide: true },
  { key: 'clientPortal', icon: <TeamOutlined /> },
  { key: 'finance', icon: <DollarOutlined /> },
  { key: 'customColumns', icon: <TableOutlined /> },
  { key: 'largeFiles', icon: <PaperClipOutlined /> },
  { key: 'chatHistory', icon: <MessageOutlined /> },
];

export const AppSumoUpgradeBanner = ({
  sourceComponent,
  showClose = false,
  onClose,
  trackView = false,
  className,
  onBeforeUpgrade,
}: AppSumoUpgradeBannerProps) => {
  const { t } = useTranslation('appsumo');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [billing, setBilling] = useState<AppSumoBillingPeriod>(APPSUMO_PROMO_DEFAULT_BILLING);

  useEffect(() => {
    if (!trackView) return;
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_VIEWED, {
      source_component: sourceComponent,
      billing: APPSUMO_PROMO_DEFAULT_BILLING,
    });
  }, [trackView, sourceComponent, trackMixpanelEvent]);

  const pricing = APPSUMO_PROMO_PRICING[billing];
  const saveAmount = pricing.regular - pricing.price;

  const handleClose = () => {
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_CLOSED, {
      source_component: sourceComponent,
      billing,
      action: 'cancel',
    });
    onClose?.();
  };

  const handleUpgradeClick = () => {
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_UPGRADE_CLICKED, {
      source_component: sourceComponent,
      billing,
      price: pricing.price,
      regular_price: pricing.regular,
    });
    onBeforeUpgrade?.();
    onClose?.();
    dispatch(openUpgradeModal());
  };

  const handleBillingChange = (period: AppSumoBillingPeriod) => {
    if (period === billing) return;
    setBilling(period);
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_BILLING_TOGGLED, {
      source_component: sourceComponent,
      billing: period,
      previous_billing: billing,
    });
  };

  return (
    <section
      className={`wl-banner${className ? ` ${className}` : ''}`}
      role="region"
      aria-label={t('popup.regionLabel', { defaultValue: 'Business plan offer' })}
    >
      {showClose && (
        <button
          type="button"
          className="wl-close"
          onClick={handleClose}
          aria-label={t('popup.closeAria', { defaultValue: 'Dismiss offer' })}
        >
          &times;
        </button>
      )}

      <div className="wl-left">
        <span className="wl-tag">
          {t('popup.tag', { defaultValue: 'AppSumo member offer' })}
        </span>
        <h2 className="wl-title">
          {t('popup.titleLine1', { defaultValue: 'Stop hitting limits.' })}
          <br />
          <span>
            {t('popup.titleHighlight', {
              defaultValue: 'Run your whole team on Business.',
            })}
          </span>
        </h2>
        <p className="wl-sub">
          {t('popup.subtitle', {
            defaultValue:
              'See where work gets stuck, keep clients in the loop, and track the budget on every project.',
          })}
        </p>

        <ul className="wl-features">
          {FEATURES.map(feature => (
            <li
              key={feature.key}
              className={`wl-feature${feature.wide ? ' wide' : ''}`}
            >
              <span className="wl-ico" aria-hidden="true">
                {feature.icon}
              </span>
              <div>
                <b>
                  {t(`popup.features.${feature.key}.title`, {
                    defaultValue: feature.key,
                  })}
                </b>
                <small>
                  {t(`popup.features.${feature.key}.description`, {
                    defaultValue: '',
                  })}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="wl-right">
        <div className="wl-badge" aria-hidden="true">
          <div>
            <strong>{t('popup.badgePercent', { defaultValue: '50%' })}</strong>
            <span>{t('popup.badgeOff', { defaultValue: 'OFF' })}</span>
            <small>{t('popup.badgeForLife', { defaultValue: 'FOR LIFE' })}</small>
          </div>
        </div>

        <div className="wl-urgency">
          {t('popup.urgency', { defaultValue: 'Limited time offer' })}
        </div>

        <div
          className="wl-toggle"
          role="group"
          aria-label={t('popup.billingAria', { defaultValue: 'Billing period' })}
        >
          <button
            type="button"
            className={billing === 'monthly' ? 'on' : undefined}
            aria-pressed={billing === 'monthly'}
            onClick={() => handleBillingChange('monthly')}
          >
            {t('popup.monthly', { defaultValue: 'Monthly' })}
          </button>
          <button
            type="button"
            className={billing === 'annual' ? 'on' : undefined}
            aria-pressed={billing === 'annual'}
            onClick={() => handleBillingChange('annual')}
          >
            {t('popup.annual', { defaultValue: 'Annual' })}
          </button>
        </div>

        <div className="wl-price-row">
          <div className="wl-price">
            <sup>$</sup>
            <span>{pricing.price}</span>
          </div>
          <div className="wl-per">
            {t('popup.perUserMonth', { defaultValue: 'per active user / month' })}
          </div>
        </div>

        <div className="wl-old">
          {t('popup.regularPrice', { defaultValue: 'Regular price' })}{' '}
          <s>${pricing.regular}</s>{' '}
          {t('popup.perUserMonthShort', { defaultValue: 'per user / month' })}
        </div>

        <div className="wl-save">
          {t('popup.youSavePrefix', { defaultValue: 'You save' })}{' '}
          <b>
            {t('popup.saveAmount', {
              defaultValue: '${{amount}} per user every month',
              amount: saveAmount,
            })}
          </b>
          {t('popup.forLifeSuffix', { defaultValue: ', for life.' })}
        </div>

        <button type="button" className="wl-cta" onClick={handleUpgradeClick}>
          {t('popup.cta', { defaultValue: 'Upgrade to Business' })}
          <i aria-hidden="true">&rarr;</i>
        </button>

        <p className="wl-fine">
          {billing === 'monthly'
            ? t('popup.fineMonthly', {
                defaultValue:
                  'Lock in 50% off for life. Monthly subscription, no long-term commitment.',
              })
            : t('popup.fineAnnual', {
                defaultValue: 'Lock in 50% off for life on the Annual plan.',
              })}
        </p>
      </div>
    </section>
  );
};

export default AppSumoUpgradeBanner;
