import React from 'react';
import { 
  Card, 
  Typography, 
  Button, 
  Space, 
  Row, 
  Col 
} from '@/shared/antd-imports';
import { 
  ShareAltOutlined 
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleViewProfile = () => {
    navigate('/profile');
  };
  
  return (
    <div>
      <Title level={3}>
        <ShareAltOutlined /> {t('settings.title')}
      </Title>
      <p>{t('settings.description')}</p>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t('settings.accountInfo')} style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">
                {t('settings.accountInfoDescription')}
              </Text>
              <Button size="large" onClick={handleViewProfile}>
                {t('settings.viewProfile')}
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SettingsPage;