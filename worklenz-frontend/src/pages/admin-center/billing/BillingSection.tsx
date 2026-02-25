import { PageHeader } from '@ant-design/pro-components';
import { Tabs, TabsProps } from '@/shared/antd-imports';
import React, { useMemo } from 'react';
import CurrentBill from '@/components/admin-center/billing/CurrentBill';
import Configuration from '@/components/admin-center/configuration/configuration';
import { useTranslation } from 'react-i18next';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useAppSelector } from '@/hooks/useAppSelector';
import { evt_current_bill_click, evt_billing_configuration_click } from '@/shared/worklenz-analytics-events';

const BillingSection: React.FC = React.memo(() => {
  const { t } = useTranslation('admin-center/current-bill');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = useAppSelector(state => state.userReducer);

  const items: TabsProps['items'] = useMemo(
    () => [
      {
        key: '1',
        label: t('currentBill'),
        children: <CurrentBill />,
      },
      {
        key: '2',
        label: t('configuration'),
        children: <Configuration />,
      },
    ],
    [t]
  );

  const pageHeaderStyle = useMemo(() => ({ padding: '16px 0' }), []);

  const handleTabChange = (key: string) => {
    if (key === '1') {
      trackMixpanelEvent(evt_current_bill_click, {
        user_type: currentSession?.subscription_type?.toLowerCase(),
        source: 'billing_section'
      });
    } else if (key === '2') {
      trackMixpanelEvent(evt_billing_configuration_click, {
        user_type: currentSession?.subscription_type?.toLowerCase(),
        source: 'billing_section'
      });
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title={<span>{t('title')}</span>} style={pageHeaderStyle} />
      <Tabs defaultActiveKey="1" items={items} onChange={handleTabChange} destroyOnHidden />
    </div>
  );
});

BillingSection.displayName = 'BillingSection';

export default BillingSection;
