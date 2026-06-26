import { Card, Col, Row, Tooltip } from '@/shared/antd-imports';
import React, { useEffect, useMemo, useCallback } from 'react';
import './current-bill.css';
import { InfoCircleTwoTone } from '@/shared/antd-imports';
import ChargesTable from './billing-tables/charges-table';
import InvoicesTable from './billing-tables/invoices-table';
import LkrPaymentHistoryTable from './billing-tables/lkr-payment-history-table';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useDebouncedMediaQuery } from '@/hooks/useDebouncedMediaQuery';
import { useTranslation } from 'react-i18next';

import {
  fetchBillingInfo,
  fetchFreePlanSettings,
} from '@/features/admin-center/admin-center.slice';

import CurrentPlanDetails from './current-plan-details/CurrentPlanDetails';
import AccountStorage from './account-storage/account-storage';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  MixpanelBillingEvents,
  BillingPageEventProps,
  UserType,
} from '@/types/mixpanel-events.types';

const PLAN_TRIAL_SUBSCRIPTION_TYPES = ['TRIAL', 'BUSINESS_TRIAL', 'ENTERPRISE_TRIAL', 'PLAN_TRIAL'];

const CurrentBill: React.FC = React.memo(() => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('admin-center/current-bill');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isTablet = useDebouncedMediaQuery({ query: '(min-width: 1025px)' });
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { billingInfo, storageInfo } = useAppSelector(state => state.adminCenterReducer);

  useEffect(() => {
    dispatch(fetchBillingInfo());
    dispatch(fetchFreePlanSettings());
  }, [dispatch]);

  // Separate effect for tracking events when billing info is available
  useEffect(() => {
    if (!billingInfo || !currentSession || !storageInfo) return;

    // Track billing page view
    const getUserType = (): UserType => {
      const planName = billingInfo?.plan_name?.toLowerCase() || '';
      const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';
      const normalizedSubscriptionType = String(currentSession?.subscription_type || '').toUpperCase();

      // Trial users should never be considered AppSumo users.
      if (PLAN_TRIAL_SUBSCRIPTION_TYPES.includes(normalizedSubscriptionType)) return 'trial';

      if (
        planName.includes('appsumo') ||
        subscriptionType.includes('appsumo') ||
        planName.includes('lifetime') ||
        subscriptionType.includes('lifetime')
      ) {
        return 'appsumo';
      }
      if (currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE) return 'free';
      return 'paid';
    };

    const eventProps: BillingPageEventProps = {
      user_type: getUserType(),
      current_plan: billingInfo?.plan_name,
      is_appsumo_user: getUserType() === 'appsumo',
      team_size: billingInfo?.total_used,
      subscription_status: billingInfo?.status,
      storage_usage_percentage: storageInfo?.used_percent,
      has_invoices: false, // Will be updated when invoices load
      has_charges: false, // Will be updated when charges load
    };

    trackMixpanelEvent(MixpanelBillingEvents.BILLING_PAGE_VIEWED, eventProps);
    trackMixpanelEvent(MixpanelBillingEvents.CURRENT_PLAN_VIEWED, eventProps);
  }, [billingInfo, currentSession, storageInfo, trackMixpanelEvent]);

  const titleStyle = useMemo(
    () => ({
      color: themeMode === 'dark' ? '#ffffffd9' : '#000000d9',
      fontWeight: 500,
      fontSize: '16px',
      display: 'flex',
      gap: '4px',
    }),
    [themeMode]
  );

  const cardStyle = useMemo(() => ({ marginTop: '16px' }), []);
  const colStyle = useMemo(() => ({ marginTop: '1.5rem' }), []);
  const tabletColStyle = useMemo(() => ({ paddingRight: '10px' }), []);
  const tabletColStyleRight = useMemo(() => ({ paddingLeft: '10px' }), []);

  const renderMobileView = useCallback(
    () => (
      <div>
        <Col span={24}>
          <CurrentPlanDetails />
        </Col>

        <Col span={24} style={colStyle}>
          <AccountStorage themeMode={themeMode} />
        </Col>
      </div>
    ),
    [colStyle, themeMode]
  );

  const renderChargesAndInvoices = useCallback(
    () => (
      <>
        <div style={colStyle}>
          <Card
            title={
              <span style={titleStyle}>
                <span>{t('charges')}</span>
                <Tooltip title={t('tooltip')}>
                  <InfoCircleTwoTone />
                </Tooltip>
              </span>
            }
            style={cardStyle}
          >
            <ChargesTable />
          </Card>
        </div>

        <div style={colStyle}>
          <Card title={<span style={titleStyle}>{t('invoices')}</span>} style={cardStyle}>
            <InvoicesTable />
          </Card>
        </div>
      </>
    ),
    [colStyle, titleStyle, cardStyle, t]
  );

  const shouldShowChargesAndInvoices = useMemo(
    () => currentSession?.subscription_type === ISUBSCRIPTION_TYPE.PADDLE,
    [currentSession?.subscription_type]
  );

  const shouldShowLkrHistory = useMemo(
    () => currentSession?.subscription_type === ISUBSCRIPTION_TYPE.ANNUAL_BUSINESS,
    [currentSession?.subscription_type]
  );

  return (
    <div style={{ width: '100%' }} className="current-billing">
      {isTablet ? (
        <Row>
          <Col span={16} style={tabletColStyle}>
            <CurrentPlanDetails />
          </Col>
          <Col span={8} style={tabletColStyleRight}>
            <AccountStorage themeMode={themeMode} />
          </Col>
        </Row>
      ) : (
        renderMobileView()
      )}
      {shouldShowChargesAndInvoices && renderChargesAndInvoices()}
      {shouldShowLkrHistory && (
        <div style={colStyle}>
          <Card title={<span style={titleStyle}>Payment History</span>} style={cardStyle}>
            <LkrPaymentHistoryTable />
          </Card>
        </div>
      )}
    </div>
  );
});

CurrentBill.displayName = 'CurrentBill';

export default CurrentBill;
