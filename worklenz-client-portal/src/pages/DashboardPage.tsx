import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Spin,
  Alert,
  Typography,
  theme,
  Button,
} from "@/shared/antd-imports";
import {
  FileTextOutlined,
  ProjectOutlined,
  FileDoneOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  RightOutlined
} from "@/shared/antd-imports";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import clientPortalAPI from "@/services/api";
import { DashboardStats } from "@/types";

const { Title, Text } = Typography;

// Stat card component for cleaner code
interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
  suffix?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, iconBg, label, value, suffix }) => {
  const { token } = theme.useToken();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '16px 20px',
      background: token.colorBgContainer,
      borderRadius: 8,
      border: `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        color: '#fff',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 2 }}>
          {label}
        </Text>
        <Text strong style={{ fontSize: 24, lineHeight: 1.2 }}>
          {value}{suffix}
        </Text>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const response = await clientPortalAPI.getDashboard();
        if (response.done) {
          setDashboardData(response.body as DashboardStats);
        } else {
          setError(t('dashboard.errorLoading'));
        }
      } catch (err) {
        setError(t('dashboard.errorLoadingDescription'));
        console.error("Dashboard API error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [t]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert message={t('dashboard.error')} description={error} type="error" showIcon />;
  }

  const stats = dashboardData || {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalRequests: 0,
    pendingRequests: 0,
    acceptedRequests: 0,
    inProgressRequests: 0,
    completedRequests: 0,
    rejectedRequests: 0,
    totalInvoices: 0,
    unpaidInvoices: 0,
    unpaidAmount: 0,
    teamMembers: 0,
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>
          {t('dashboard.title')}
        </Title>
        <Text type="secondary">
          {t('dashboard.welcome')}
        </Text>
      </div>

      {/* Quick Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ProjectOutlined />}
            iconBg="#1890ff"
            label={t('dashboard.activeProjects')}
            value={stats.activeProjects}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<FileTextOutlined />}
            iconBg="#722ed1"
            label={t('dashboard.pendingRequests')}
            value={stats.pendingRequests}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ClockCircleOutlined />}
            iconBg="#fa8c16"
            label={t('dashboard.inProgress')}
            value={stats.inProgressRequests}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<DollarOutlined />}
            iconBg={stats.unpaidAmount > 0 ? '#ff4d4f' : '#52c41a'}
            label={t('dashboard.unpaidAmount')}
            value={stats.unpaidAmount.toFixed(2)}
            suffix=""
          />
        </Col>
      </Row>

      {/* Projects & Requests Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ProjectOutlined style={{ color: token.colorPrimary }} />
                <span>{t('dashboard.projectsOverview')}</span>
              </div>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/projects')}>
                {t('dashboard.viewAll')} <RightOutlined />
              </Button>
            }
            styles={{ body: { padding: 20 } }}
          >
            <Row gutter={24}>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 600, color: token.colorText }}>
                  {stats.totalProjects}
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>{t('dashboard.total')}</Text>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 600, color: '#1890ff' }}>
                  {stats.activeProjects}
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>{t('dashboard.active')}</Text>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 600, color: '#52c41a' }}>
                  {stats.completedProjects}
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>{t('dashboard.completed')}</Text>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: '#722ed1' }} />
                <span>{t('dashboard.requestsOverview')}</span>
              </div>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/requests')}>
                {t('dashboard.viewAll')} <RightOutlined />
              </Button>
            }
            styles={{ body: { padding: 20 } }}
          >
            <Row gutter={16}>
              <Col span={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: token.colorText }}>
                  {stats.totalRequests}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('dashboard.total')}</Text>
              </Col>
              <Col span={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#fa8c16' }}>
                  {stats.pendingRequests}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('dashboard.pending')}</Text>
              </Col>
              <Col span={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#1890ff' }}>
                  {stats.inProgressRequests}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('dashboard.inProgressShort')}</Text>
              </Col>
              <Col span={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#52c41a' }}>
                  {stats.completedRequests}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('dashboard.done')}</Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Invoices Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileDoneOutlined style={{ color: '#13c2c2' }} />
            <span>{t('dashboard.invoicesOverview')}</span>
          </div>
        }
        extra={
          <Button type="link" size="small" onClick={() => navigate('/invoices')}>
            {t('dashboard.viewAll')} <RightOutlined />
          </Button>
        }
        styles={{ body: { padding: 20 } }}
      >
        <Row gutter={24}>
          <Col xs={24} sm={8} style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: token.colorText }}>
              {stats.totalInvoices}
            </div>
            <Text type="secondary">{t('dashboard.totalInvoices')}</Text>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: stats.unpaidInvoices > 0 ? '#ff4d4f' : token.colorText }}>
              {stats.unpaidInvoices}
            </div>
            <Text type="secondary">{t('dashboard.unpaidInvoices')}</Text>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 16px',
              background: stats.unpaidAmount > 0 ? '#fff2f0' : '#f6ffed',
              borderRadius: 8,
            }}>
              <CheckCircleOutlined style={{ color: stats.unpaidAmount > 0 ? '#ff4d4f' : '#52c41a' }} />
              <Text strong style={{ fontSize: 20, color: stats.unpaidAmount > 0 ? '#ff4d4f' : '#52c41a' }}>
                ${stats.unpaidAmount.toFixed(2)}
              </Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">{t('dashboard.amountDue')}</Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DashboardPage;
