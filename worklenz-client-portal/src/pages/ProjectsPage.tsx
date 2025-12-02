import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  Typography, 
  Table, 
  Tag, 
  Space, 
  Button, 
  Input, 
  Select, 
  Alert,
  Progress,
  Tooltip
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { 
  EyeOutlined, 
  SearchOutlined,
  ProjectOutlined,
  CalendarOutlined
} from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import clientPortalAPI from '@/services/api';
import { ClientProject } from '@/types';

const { Title, Text } = Typography;
const { Search } = Input;

const ProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  });

  const fetchProjects = useCallback(async (page = 1, pageSize = 10, search = '', status = '') => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await clientPortalAPI.getProjects({
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
      });

      if (response.done) {
        setProjects((response.body as any).projects || []);
        setPagination({
          current: (response.body as any).page,
          pageSize: (response.body as any).limit,
          total: (response.body as any).total,
        });
      } else {
        setError(t('projects.tryAgain'));
      }
    } catch (err) {
      setError(t('dashboard.errorLoadingDescription'));
      console.error('Projects API error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleTableChange = (paginationInfo: { current?: number; pageSize?: number }) => {
    fetchProjects(
      paginationInfo.current || 1,
      paginationInfo.pageSize || 10,
      filters.search,
      filters.status
    );
  };

  const handleSearch = (value: string) => {
    setFilters({ ...filters, search: value });
    fetchProjects(1, pagination.pageSize, value, filters.status);
  };

  const handleStatusFilter = (value: string) => {
    setFilters({ ...filters, status: value });
    fetchProjects(1, pagination.pageSize, filters.search, value);
  };

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'Active': 'blue',
      'Completed': 'green',
      'On Hold': 'orange',
      'Cancelled': 'red',
      'Planning': 'purple',
    };
    return statusColors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'Active': t('projects.active'),
      'Completed': t('projects.completed'),
      'On Hold': t('projects.onHold'),
      'Cancelled': t('projects.cancelled'),
      'Planning': t('projects.planning'),
    };
    return statusMap[status] || status;
  };

  const columns = [
    {
      title: t('projects.projectName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ClientProject) => (
        <Space direction="vertical" size="small">
          <Button
            type="link"
            icon={<ProjectOutlined />}
            onClick={() => navigate(`/projects/${record.id}`)}
            style={{ padding: 0, height: 'auto' }}
          >
            <strong>{text}</strong>
          </Button>
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
      title: t('projects.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ClientProject) => (
        <Tag color={getStatusColor(status)} style={{ color: record.status_color }}>
          {getStatusLabel(status)}
        </Tag>
      ),
      filters: [
        { text: t('projects.active'), value: 'Active' },
        { text: t('projects.completed'), value: 'Completed' },
        { text: t('projects.onHold'), value: 'On Hold' },
        { text: t('projects.cancelled'), value: 'Cancelled' },
        { text: t('projects.planning'), value: 'Planning' },
      ],
    },
    {
      title: t('projects.progress'),
      key: 'progress',
      render: (record: ClientProject) => {
        const progress = record.total_tasks > 0 
          ? Math.round((record.completed_tasks / record.total_tasks) * 100)
          : 0;
        
        return (
          <Space direction="vertical" size="small">
            <Progress 
              percent={progress} 
              size="small" 
              status={progress === 100 ? 'success' : 'active'}
            />
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.completed_tasks} / {record.total_tasks} {t('projects.tasks')}
            </div>
          </Space>
        );
      },
    },
    {
      title: t('projects.lastUpdated'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <Space>
            <CalendarOutlined />
            {new Date(date).toLocaleDateString()}
          </Space>
        </Tooltip>
      ),
    },
    {
      title: t('projects.actions'),
      key: 'actions',
      render: (record: ClientProject) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/projects/${record.id}`)}
          size="small"
        >
          {t('projects.viewDetails')}
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <Alert
        message={t('common.error')}
        description={error}
        type="error"
        showIcon
        action={
          <Button onClick={() => fetchProjects()}>
            {t('projects.tryAgain')}
          </Button>
        }
      />
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            <ProjectOutlined style={{ marginRight: 8 }} />
            {t('projects.title')}
          </Title>
          <Text type="secondary">{t('projects.description')}</Text>
        </div>
      </div>

      <Card size="small">
        {/* Filters */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <Search
            placeholder={t('projects.searchPlaceholder')}
            allowClear
            onSearch={handleSearch}
            style={{ width: 240 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder={t('projects.filterByStatus')}
            allowClear
            style={{ width: 140 }}
            onChange={handleStatusFilter}
            value={filters.status || undefined}
            options={[
              { value: 'Active', label: t('projects.active') },
              { value: 'Completed', label: t('projects.completed') },
              { value: 'On Hold', label: t('projects.onHold') },
              { value: 'Cancelled', label: t('projects.cancelled') },
              { value: 'Planning', label: t('projects.planning') },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={isLoading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              t('projects.showingRange', { start: range[0], end: range[1], total }),
          }}
          onChange={handleTableChange}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default ProjectsPage;