import { Button, Flex, Typography } from '@/shared/antd-imports';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import ServicesTable from './ServicesTable';

const { Title } = Typography;

const ClientPortalServices = () => {
  const { t } = useTranslation('client-portal-services');
  const navigate = useNavigate();
  useDocumentTitle('Services');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        maxWidth: '100%',
      }}
    >
      <Flex
        align="flex-start"
        justify="space-between"
        wrap="wrap"
        gap={12}
        style={{ marginBottom: 16, flexShrink: 0 }}
      >
        <div style={{ minWidth: 0 }}>
          <Title level={4} style={{ margin: 0, fontSize: 22 }}>
            {t('title', { defaultValue: 'Services' })}
          </Title>
          <Typography.Text type="secondary">
            {t('description', { defaultValue: 'Manage your services and offerings' })}
          </Typography.Text>
        </div>

        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => navigate('/worklenz/client-portal/services/create')}
        >
          {t('addServiceButton', { defaultValue: 'Add Service' })}
        </Button>
      </Flex>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ServicesTable />
      </div>

      {/* services/create and services/:id/edit render here as a modal over this list, so a
          direct or shared link still shows the list underneath it instead of a blank page. */}
      <Outlet />
    </div>
  );
};

export default ClientPortalServices;
