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

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
  return (
    <div>
      <Title level={2}>
        <ShareAltOutlined /> Settings
      </Title>
      <p>Manage your account settings and preferences</p>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Account Information" style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">
                View your account details and billing information in the Profile section.
              </Text>
              <Button size="large">
                View Profile
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SettingsPage;