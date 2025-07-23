import { Card, Col, Row, Tooltip } from '@/shared/antd-imports';
import React, { useEffect, useMemo, useCallback } from 'react';
import './current-bill.css';
import { InfoCircleTwoTone } from '@/shared/antd-imports';
import ChargesTable from './billing-tables/charges-table';
import InvoicesTable from './billing-tables/invoices-table';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';

import {
  fetchBillingInfo,
  fetchFreePlanSettings,
} from '@/features/admin-center/admin-center.slice';

import CurrentPlanDetails from './current-plan-details/current-plan-details';
import AccountStorage from './account-storage/account-storage';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

const CurrentBill: React.FC = React.memo(() => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('admin-center/current-bill');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isTablet = useMediaQuery({ query: '(min-width: 1025px)' });
  const currentSession = useAuthService().getCurrentSession();

  useEffect(() => {
    dispatch(fetchBillingInfo());
    dispatch(fetchFreePlanSettings());
  }, [dispatch]);

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
    </div>
  );
});

CurrentBill.displayName = 'CurrentBill';

export default CurrentBill;
