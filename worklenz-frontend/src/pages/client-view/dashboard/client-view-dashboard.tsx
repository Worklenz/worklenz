import { Card, Col, Flex, Row, Statistic, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { 
  FileTextOutlined, 
  ProjectOutlined, 
  MessageOutlined, 
  DollarOutlined 
} from '@ant-design/icons';

const ClientViewDashboard = () => {
  const { t } = useTranslation('client-view-dashboard');
  
  // Get client data from Redux (replace with real API calls)
  const clientStats = useAppSelector((state) => state.clientViewReducer.dashboardReducer?.stats || {
    totalRequests: 0,
    pendingRequests: 0,
    totalProjects: 0,
    activeProjects: 0,
    totalInvoices: 0,
    unpaidInvoices: 0,
    unreadMessages: 0
  });

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ marginBlock: 0 }}>
        {t('title')}
      </Typography.Title>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('totalRequests')}
              value={clientStats.totalRequests}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('pendingRequests')}
              value={clientStats.pendingRequests}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('activeProjects')}
              value={clientStats.activeProjects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('unpaidInvoices')}
              value={clientStats.unpaidInvoices}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t('recentRequests')} style={{ height: 400 }}>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Typography.Text type="secondary">
                {t('noRecentRequests')}
              </Typography.Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('recentMessages')} style={{ height: 400 }}>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Typography.Text type="secondary">
                {t('noRecentMessages')}
              </Typography.Text>
            </div>
          </Card>
        </Col>
      </Row>
    </Flex>
  );
};

export default ClientViewDashboard; 