import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Typography, 
  Row, 
  Col, 
  Spin, 
  Alert, 
  Tag, 
  Progress, 
  Table,
  Avatar,
  Space,
  Descriptions,
  Button,
  List
} from 'antd';
import { 
  ProjectOutlined, 
  TeamOutlined, 
  CalendarOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import clientPortalAPI from '@/services/api';
import { ProjectDetails } from '@/types';

const { Title, Paragraph } = Typography;

const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProjectDetails(id);
    }
  }, [id]);

  const fetchProjectDetails = async (projectId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await clientPortalAPI.getProjectDetails(projectId);

      if (response.done) {
        setProjectDetails(response.body as ProjectDetails);
      } else {
        setError('Failed to load project details');
      }
    } catch (err) {
      setError('Failed to load project details. Please try again later.');
      console.error('Project details API error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>Loading project details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error"
        description={error}
        type="error"
        showIcon
        action={
          <Space>
            <Button onClick={() => navigate('/projects')}>
              Back to Projects
            </Button>
            <Button onClick={() => id && fetchProjectDetails(id)}>
              Try Again
            </Button>
          </Space>
        }
      />
    );
  }

  if (!projectDetails) {
    return (
      <Alert
        message="Project Not Found"
        description="The requested project could not be found."
        type="warning"
        showIcon
        action={
          <Button onClick={() => navigate('/projects')}>
            Back to Projects
          </Button>
        }
      />
    );
  }

  const taskColumns = [
    {
      title: 'Task Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space direction="vertical" size="small">
          <strong>{text}</strong>
          {record.description && (
            <div style={{ color: '#666', fontSize: '12px' }}>
              {record.description.length > 100 
                ? `${record.description.substring(0, 100)}...` 
                : record.description
              }
            </div>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => (
        <Tag color={record.statusColor}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (record: any) => {
        if (record.startDate && record.endDate) {
          const start = new Date(record.startDate);
          const end = new Date(record.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return `${diffDays} days`;
        }
        return '-';
      },
    },
    {
      title: 'Comments',
      dataIndex: 'commentCount',
      key: 'commentCount',
      render: (count: number) => (
        <Space>
          <FileTextOutlined />
          {count}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/projects')}
        >
          Back to Projects
        </Button>
      </Space>

      <Title level={2}>
        <ProjectOutlined /> {projectDetails.name}
      </Title>

      <Row gutter={[16, 16]}>
        {/* Project Overview */}
        <Col xs={24} lg={16}>
          <Card title="Project Information">
            <Descriptions column={{ xs: 1, sm: 2 }} bordered>
              <Descriptions.Item label="Status">
                <Tag color={projectDetails.statusColor}>
                  {projectDetails.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Client">
                <Space>
                  <TeamOutlined />
                  {projectDetails.client.name}
                  {projectDetails.client.companyName && (
                    <span style={{ color: '#666' }}>
                      ({projectDetails.client.companyName})
                    </span>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {projectDetails.startDate ? (
                  <Space>
                    <CalendarOutlined />
                    {new Date(projectDetails.startDate).toLocaleDateString()}
                  </Space>
                ) : (
                  'Not set'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {projectDetails.endDate ? (
                  <Space>
                    <CalendarOutlined />
                    {new Date(projectDetails.endDate).toLocaleDateString()}
                  </Space>
                ) : (
                  'Not set'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created" span={2}>
                <Space>
                  <CalendarOutlined />
                  {new Date(projectDetails.createdAt).toLocaleDateString()}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {projectDetails.description && (
              <div style={{ marginTop: 16 }}>
                <Title level={4}>Description</Title>
                <Paragraph>{projectDetails.description}</Paragraph>
              </div>
            )}
          </Card>
        </Col>

        {/* Project Statistics */}
        <Col xs={24} lg={8}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title="Progress Overview">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Task Completion</strong>
                    </div>
                    <Progress 
                      percent={projectDetails.statistics.progressPercentage}
                      status={projectDetails.statistics.progressPercentage === 100 ? 'success' : 'active'}
                    />
                    <div style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>
                      {projectDetails.statistics.completedTasks} / {projectDetails.statistics.totalTasks} tasks completed
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>

            <Col span={24}>
              <Card title="Team Members">
                <List
                  itemLayout="horizontal"
                  size="small"
                  dataSource={projectDetails.teamMembers}
                  renderItem={(member) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          member.avatarUrl ? (
                            <Avatar src={member.avatarUrl} />
                          ) : (
                            <Avatar icon={<UserOutlined />} />
                          )
                        }
                        title={member.fullName}
                        description={
                          <Space direction="vertical" size="small">
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {member.email}
                            </div>
                            {member.roleName && (
                              <Tag>{member.roleName}</Tag>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Recent Tasks */}
        <Col span={24}>
          <Card 
            title={
              <Space>
                <CheckCircleOutlined />
                Recent Tasks
              </Space>
            }
          >
            <Table
              columns={taskColumns}
              dataSource={projectDetails.recentTasks}
              rowKey="id"
              pagination={false}
              scroll={{ x: 600 }}
              locale={{
                emptyText: 'No tasks available'
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProjectDetailsPage;