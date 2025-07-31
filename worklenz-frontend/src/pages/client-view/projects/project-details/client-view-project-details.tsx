import { Card, Descriptions, Flex, Progress, Typography, Button, Row, Col, Tag } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { durationDateFormat } from '../../../../utils/durationDateFormat';
import { CalendarOutlined, TeamOutlined, FileTextOutlined } from '@ant-design/icons';

const ClientViewProjectDetails = () => {
  const { t } = useTranslation('client-view-projects');
  const { id } = useParams();
  const navigate = useNavigate();

  // Get project details from Redux (replace with API call)
  const projectDetails = useAppSelector((state) => 
    state.clientViewReducer.projectsReducer.projectsList.find((project: any) => project.id === id)
  );

  if (!projectDetails) {
    return (
      <Flex vertical gap={24} style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('projectNotFound')}
        </Typography.Title>
        <Button onClick={() => navigate('/client-portal/projects')}>
          {t('backToProjects')}
        </Button>
      </Flex>
    );
  }

  const progressPercent = projectDetails.totalTasks > 0 
    ? (projectDetails.completedTasks / projectDetails.totalTasks) * 100 
    : 0;

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between">
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {projectDetails.name}
        </Typography.Title>
        <Button onClick={() => navigate('/client-portal/projects')}>
          {t('backToProjects')}
        </Button>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title={t('projectOverview')}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label={t('status')} span={1}>
                <Tag color="blue">{projectDetails.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('progress')} span={1}>
                <Progress percent={progressPercent} size="small" />
              </Descriptions.Item>
              <Descriptions.Item label={t('totalTasks')} span={1}>
                {projectDetails.totalTasks}
              </Descriptions.Item>
              <Descriptions.Item label={t('completedTasks')} span={1}>
                {projectDetails.completedTasks}
              </Descriptions.Item>
              <Descriptions.Item label={t('lastUpdated')} span={2}>
                {durationDateFormat(projectDetails.lastUpdated)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={t('projectDescription')} style={{ marginTop: 16 }}>
            <Typography.Paragraph>
              {projectDetails.description || t('noDescription')}
            </Typography.Paragraph>
          </Card>

          <Card title={t('recentActivity')} style={{ marginTop: 16 }}>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Typography.Text type="secondary">
                {t('noRecentActivity')}
              </Typography.Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={t('projectTeam')}>
            <Flex vertical gap={12}>
              {projectDetails.members.map((member: string, index: number) => (
                <Flex key={index} align="center" gap={8}>
                  <TeamOutlined />
                  <Typography.Text>{member}</Typography.Text>
                </Flex>
              ))}
            </Flex>
          </Card>

          <Card title={t('projectTimeline')} style={{ marginTop: 16 }}>
            <Flex vertical gap={12}>
              <Flex align="center" gap={8}>
                <CalendarOutlined />
                <Typography.Text>{t('startDate')}: {t('notSet')}</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <CalendarOutlined />
                <Typography.Text>{t('endDate')}: {t('notSet')}</Typography.Text>
              </Flex>
            </Flex>
          </Card>

          <Card title={t('projectFiles')} style={{ marginTop: 16 }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <FileTextOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
              <br />
              <Typography.Text type="secondary">
                {t('noFiles')}
              </Typography.Text>
            </div>
          </Card>
        </Col>
      </Row>
    </Flex>
  );
};

export default ClientViewProjectDetails; 