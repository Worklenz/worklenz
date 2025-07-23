import { PageHeader } from '@ant-design/pro-components';
import { Tabs, TabsProps } from '@/shared/antd-imports';
import React, { useMemo } from 'react';
import CurrentBill from '@/components/admin-center/billing/current-bill';
import Configuration from '@/components/admin-center/configuration/configuration';
import { useTranslation } from 'react-i18next';

const Billing: React.FC = React.memo(() => {
  const { t } = useTranslation('admin-center/current-bill');

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

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title={<span>{t('title')}</span>} style={pageHeaderStyle} />
      <Tabs defaultActiveKey="1" items={items} destroyOnHidden />
    </div>
  );
});

Billing.displayName = 'Billing';

export default Billing;
