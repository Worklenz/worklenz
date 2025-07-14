import { Flex, Typography } from 'antd';

import { useTranslation } from 'react-i18next';

const ClientPortalInvoices = () => {
  // localization
  const { t } = useTranslation('client-portal-requests');

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={5}>{t('title')}</Typography.Title>
      </Flex>

      <div>client portal invoices</div>
    </Flex>
  );
};

export default ClientPortalInvoices;