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
import TaskDrawer from '@/components/TaskDrawer/TaskDrawer';

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
  unseenCommentsCount: number;
  timeLogged: string;
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

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
        <div
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setSelectedTaskId(record.id);
            setIsTaskDrawerOpen(true);
          }}
        >
          <Text strong style={{ color: token.colorPrimary }}>{text}</Text>
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
      title: 'Time Logged',
      dataIndex: 'timeLogged',
      key: 'timeLogged',
      width: 130,
      render: (time: string) => (
        <Space size="small">
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
            {time || '0h 0m'}
          </Text>
        </Space>
      ),
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

      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '16px 24px' } }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Space size={12} align="center">
                <ProjectOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
                <div>
                  <Space size={8} align="center" wrap>
                    <Title level={4} style={{ margin: 0 }}>{projectDetails.name}</Title>
                    <Tag color={projectDetails.statusColor}>{projectDetails.status}</Tag>
                  </Space>
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      <CalendarOutlined style={{ marginRight: 4 }} />
                      {formatDate(projectDetails.startDate)} - {formatDate(projectDetails.endDate)}
                    </Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <Progress
                  type="circle"
                  percent={projectDetails.statistics.progressPercentage}
                  size={64}
                  strokeWidth={8}
                  strokeColor={
                    projectDetails.statistics.progressPercentage === 100
                      ? token.colorSuccess
                      : token.colorPrimary
                  }
                  trailColor={
                    currentTheme === 'dark' ? token.colorBorderSecondary : token.colorFillSecondary
                  }
                  format={(percent) => (
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{percent ?? 0}%</span>
                  )}
                  status={projectDetails.statistics.progressPercentage === 100 ? 'success' : 'active'}
                />
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {projectDetails.statistics.completedTasks}/{projectDetails.statistics.totalTasks} tasks
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
          {projectDetails.description && (
            <Row>
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {projectDetails.description}
                </Text>
              </Col>
            </Row>
          )}
        </Space>
      </Card>

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
          scroll={{ x: 800 }}
          locale={{
            emptyText: 'No tasks found'
          }}
          size="small"
        />
      </Card>

      <TaskDrawer
        open={isTaskDrawerOpen}
        taskId={selectedTaskId}
        unseenCommentsCount={
          selectedTaskId
            ? tasks.find(task => task.id === selectedTaskId)?.unseenCommentsCount || 0
            : 0
        }
        onClose={() => {
          setIsTaskDrawerOpen(false);
          setSelectedTaskId(null);
        }}
        onTaskUpdated={() => {
          if (id) {
            fetchProjectTasks(id, tasksPagination.current, tasksPagination.pageSize, searchText);
          }
        }}
      />
    </div>
  );
};

export default ProjectDetailsPage;