import { Button, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { useNavigate } from 'react-router-dom';
import ServicesTable from './services-table';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
const ClientPortalServices = () => {
  // localization
  const { t } = useTranslation('client-portal-services');

  const navigate = useNavigate();

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={5}>{t('title')}</Typography.Title>

        <Button
          type="primary"
          onClick={() => navigate('/worklenz/client-portal/add-service')}
        >
          {t('addServiceButton')}
        </Button>
      </Flex>

      <ServicesTable />
    </Flex>
  );
};

export default ClientPortalServices;
