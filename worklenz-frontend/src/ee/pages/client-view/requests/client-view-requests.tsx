import { Flex, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import RequestsTable from './requests-table';

const ClientViewRequests = () => {
  // localization
  const { t } = useTranslation('client-view/client-view-requests');

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('title')}
        </Typography.Title>
      </Flex>

      <RequestsTable />
    </Flex>
  );
};

export default ClientViewRequests;
