import { Flex, Typography, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { FileTextOutlined } from '@ant-design/icons';
import { useResponsive } from '../../../hooks/useResponsive';
import RequestsTable from './requests-table';

const ClientPortalRequests = () => {
  // localization
  const { t } = useTranslation('client-portal-requests');
  const { isDesktop } = useResponsive();

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
              <FileTextOutlined style={{ fontSize: 20 }} />
              <Typography.Title 
                level={4} 
                style={{ 
                  margin: 0,
                  fontSize: '20px',
                }}
              >
                {t('title') || 'Requests'}
              </Typography.Title>
            </Flex>
            <Typography.Text 
              type="secondary"
              style={{ 
                fontSize: isDesktop ? '16px' : '14px',
                lineHeight: 1.5,
              }}
            >
              {t('description') || 'Manage and track client requests'}
            </Typography.Text>
          </div>
        </Flex>
      </div>

      {/* Requests Table */}
      <Card 
        style={{ 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 8,
        }}
      >
        <RequestsTable />
      </Card>
    </div>
  );
};

export default ClientPortalRequests;
