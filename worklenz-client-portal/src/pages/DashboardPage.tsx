import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  Alert,
  Typography,
  Flex,
  FileTextOutlined,
  ProjectOutlined,
  FileDoneOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
} from "@/shared/antd-imports";
import { useTranslation } from "react-i18next";
import clientPortalAPI from "@/services/api";
import { DashboardStats } from "@/types";

const { Title, Paragraph } = Typography;

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(
    null
  );
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
  }, []);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "16px" }}>{t('dashboard.loading')}</div>
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
  };

  return (
    <Flex vertical gap={24} style={{ width: "100%" }}>
      <Flex vertical gap={8}>
        <Title level={1} style={{ margin: 0 }}>
          {t('dashboard.title')}
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {t('dashboard.welcome')}
        </Paragraph>
      </Flex>

      {/* Projects Overview */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('dashboard.totalProjects')}
              value={stats.totalProjects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('dashboard.activeProjects')}
              value={stats.activeProjects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('dashboard.completedProjects')}
              value={stats.completedProjects}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#3f8600" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Requests Overview */}
      <Row gutter={[16, 16]} style={{ marginTop: "16px" }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.totalRequests')}
              value={stats.totalRequests}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: "#595959" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.pending')}
              value={stats.pendingRequests}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.inProgress')}
              value={stats.inProgressRequests}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.completed')}
              value={stats.completedRequests}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Financial Overview */}
      <Row gutter={[16, 16]} style={{ marginTop: "16px" }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('dashboard.totalInvoices')}
              value={stats.totalInvoices}
              prefix={<FileDoneOutlined />}
              valueStyle={{ color: "#13c2c2" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('dashboard.unpaidInvoices')}
              value={stats.unpaidInvoices}
              prefix={<FileDoneOutlined />}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('dashboard.unpaidAmount')}
              value={stats.unpaidAmount}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
};

export default DashboardPage;
