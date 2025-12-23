import React, { useEffect, useState, useCallback } from 'react';
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
  Space,
  Descriptions,
  Button,
  Input,
  ProjectOutlined, 
  CalendarOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  theme
} from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';

import { useParams, useNavigate } from 'react-router-dom';
import clientPortalAPI from '@/services/api';

const { Title, Text } = Typography;

interface ProjectDetails {
  id: string;
  name: string;
  description: string | null;
  status: string;
  statusColor: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  statistics: {
    totalTasks: number;
    completedTasks: number;
    progressPercentage: number;
  };
}

interface ProjectTask {
  id: string;
  name: string;
  description: string | null;
  status: string;
  statusColor: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const currentTheme = useAppSelector((state) => state.ui.theme);
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasksPagination, setTasksPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [searchText, setSearchText] = useState('');

  const fetchProjectDetails = useCallback(async (projectId: string) => {
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
  }, []);

  const fetchProjectTasks = useCallback(async (projectId: string, page = 1, limit = 10, search = '') => {
    try {
      setIsTasksLoading(true);
      
      const response = await clientPortalAPI.getProjectTasks(projectId, { page, limit, search });

      if (response.done && response.body) {
        const data = response.body as { tasks: ProjectTask[]; total: number; page: number; limit: number };
        setTasks(data.tasks);
        setTasksPagination({
          current: data.page,
          pageSize: data.limit,
          total: data.total
        });
      }
    } catch (err) {
      console.error('Project tasks API error:', err);
    } finally {
      setIsTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchProjectDetails(id);
      fetchProjectTasks(id, 1, 10, '');
    }
  }, [id, fetchProjectDetails, fetchProjectTasks]);

  const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
    if (id) {
      fetchProjectTasks(id, pagination.current || 1, pagination.pageSize || 10, searchText);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    if (id) {
      fetchProjectTasks(id, 1, tasksPagination.pageSize, value);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      render: (text: string, record: ProjectTask) => (
        <div>
          <Text strong>{text}</Text>
          {record.description && (
            <div style={{ color: '#666', fontSize: '12px', marginTop: 4 }}>
              {record.description.length > 80 
                ? `${record.description.substring(0, 80)}...` 
                : record.description
              }
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: ProjectTask) => (
        <Tag color={record.statusColor}>
          {status || 'No Status'}
        </Tag>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (date: string | null) => formatDate(date),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (date: string | null) => formatDate(date),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (date: string) => (
        <Space size="small">
          <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
          <Text type="secondary">{formatDateTime(date)}</Text>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate('/projects')}
        style={{ marginBottom: 16 }}
      >
        Back to Projects
      </Button>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col flex="auto">
            <Space align="center" size="middle">
              <ProjectOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>{projectDetails.name}</Title>
                <Tag color={projectDetails.statusColor} style={{ marginTop: 8 }}>
                  {projectDetails.status}
                </Tag>
              </div>
            </Space>
          </Col>
          <Col>
            <Card
              size="small"
              style={{
                background: token.colorBgElevated,
                border: `1px solid ${token.colorBorderSecondary}`,
                boxShadow: token.boxShadowTertiary,
              }}
            >
              <Space direction="vertical" align="center" size={0}>
                <Text type="secondary" style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  Progress
                </Text>
                <Progress 
                  type="circle" 
                  percent={projectDetails.statistics.progressPercentage}
                  size={80}
                  strokeColor={
                    projectDetails.statistics.progressPercentage === 100
                      ? token.colorSuccess
                      : token.colorPrimary
                  }
                  trailColor={
                    currentTheme === 'dark' ? token.colorBorderSecondary : token.colorFillSecondary
                  }
                  format={(percent) => `${percent ?? 0}%`}
                  status={projectDetails.statistics.progressPercentage === 100 ? 'success' : 'active'}
                />
                <Text type="secondary" style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {projectDetails.statistics.completedTasks}/{projectDetails.statistics.totalTasks} tasks
                </Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card title="Project Details" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Start Date">
                <Space>
                  <CalendarOutlined />
                  {formatDate(projectDetails.startDate)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                <Space>
                  <CalendarOutlined />
                  {formatDate(projectDetails.endDate)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {formatDate(projectDetails.createdAt)}
              </Descriptions.Item>
            </Descriptions>
            {projectDetails.description && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Description</Text>
                <div style={{ marginTop: 4 }}>{projectDetails.description}</div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card 
            title={
              <Space>
                <CheckCircleOutlined />
                Tasks
                <Tag>{tasksPagination.total}</Tag>
              </Space>
            }
            extra={
              <Input.Search
                placeholder="Search tasks..."
                allowClear
                onSearch={handleSearch}
                style={{ width: 200 }}
                prefix={<SearchOutlined />}
              />
            }
          >
            <Table
              columns={taskColumns}
              dataSource={tasks}
              rowKey="id"
              loading={isTasksLoading}
              pagination={{
                current: tasksPagination.current,
                pageSize: tasksPagination.pageSize,
                total: tasksPagination.total,
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tasks`,
                pageSizeOptions: ['10', '20', '50']
              }}
              onChange={handleTableChange}
              scroll={{ x: 700 }}
              locale={{
                emptyText: 'No tasks found'
              }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProjectDetailsPage;