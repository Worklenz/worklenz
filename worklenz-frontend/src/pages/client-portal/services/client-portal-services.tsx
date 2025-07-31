import { Button, Flex, Typography, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, AppstoreOutlined } from '@ant-design/icons';
import ServicesTable from './services-table';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useResponsive } from '@/hooks/useResponsive';
const ClientPortalServices = () => {
  // localization
  const { t } = useTranslation('client-portal-services');
  const { isDesktop } = useResponsive();
  const navigate = useNavigate();

  return (
    <div style={{ 
      maxWidth: '100%',
      minHeight: 'calc(100vh - 120px)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: isDesktop ? 32 : 24 }}>
        <Flex 
          align="center" 
          justify="space-between" 
          style={{ width: '100%' }}
          wrap="wrap"
          gap={16}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
              <AppstoreOutlined style={{ fontSize: 20 }} />
              <Typography.Title 
                level={4} 
                style={{ 
                  margin: 0,
                  fontSize: '20px',
                }}
              >
                {t('title') || 'Services'}
              </Typography.Title>
            </Flex>
            <Typography.Text 
              type="secondary"
              style={{ 
                fontSize: isDesktop ? '16px' : '14px',
                lineHeight: 1.5,
              }}
            >
              {t('description') || 'Manage your services and offerings'}
            </Typography.Text>
          </div>
          
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/worklenz/client-portal/add-service')}
          >
            {t('addServiceButton') || 'Add Service'}
          </Button>
        </Flex>
      </div>

      {/* Services Table */}
      <Card 
        style={{ 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 8,
        }}
      >
        <ServicesTable />
      </Card>
    </div>
  );
};

export default ClientPortalServices;
