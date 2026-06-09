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
  CalendarOutlined,
  ClockCircleOutlined,
} from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import clientPortalAPI from '@/services/api';
import { ClientProject } from '@/types';

const { Title, Text } = Typography;
const { Search } = Input;

interface ProjectStatus {
  id: string;
  name: string;
  colorCode: string;
  icon: string | null;
  isDefault: boolean;
  sortOrder: number;
}

const ProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([]);
  const [timeLogs, setTimeLogs] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isStatusesLoading, setIsStatusesLoading] = useState(true);
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

  const fetchProjectStatuses = useCallback(async () => {
    try {
      setIsStatusesLoading(true);
      const response = await clientPortalAPI.getProjectStatuses();
      if (response.done && response.body) {
        setProjectStatuses(response.body as ProjectStatus[]);
      }
    } catch (err) {
      console.error('Error loading project statuses:', err);
    } finally {
      setIsStatusesLoading(false);
    }
  }, []);

  const fetchTimeLogs = useCallback(async () => {
    try {
      const response = await clientPortalAPI.getProjectTimeLogs();
      if (response.done && response.body) {
        setTimeLogs(response.body as Record<string, string>);
      }
    } catch (err) {
      console.error('Error loading time logs:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjectStatuses();
  }, [fetchProjectStatuses]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchTimeLogs();
  }, [fetchTimeLogs]);

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

  const handleStatusFilter = (value: string | null) => {
    const statusValue = value || '';
    setFilters({ ...filters, status: statusValue });
    fetchProjects(1, pagination.pageSize, filters.search, statusValue);
  };

  const getStatusColor = (status: string) => {
    const statusObj = projectStatuses.find(s => s.name === status);
    if (statusObj?.colorCode) {
      const colorMap: { [key: string]: string } = {
        '#1890ff': 'blue',
        '#52c41a': 'green',
        '#faad14': 'orange',
        '#f5222d': 'red',
        '#722ed1': 'purple',
        '#13c2c2': 'cyan',
        '#eb2f96': 'magenta',
        '#fa8c16': 'orange',
      };
      return colorMap[statusObj.colorCode.toLowerCase()] || statusObj.colorCode;
    }
    return 'default';
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
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Tag>
      ),
      filters: projectStatuses.map(status => ({
        text: getStatusLabel(status.name),
        value: status.name,
      })),
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
      title: t('Time Logs') || 'Time Logged',
      key: 'time_logged',
      render: (_: unknown, record: ClientProject) => {
        const time = timeLogs[record.id];
        return (
          <Tooltip title="Total time logged across all tasks">
            <Space>
              <ClockCircleOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {time ?? '—'}
              </span>
            </Space>
          </Tooltip>
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
          <Title level={3} style={{ marginBottom: 4 }}>
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
            loading={isStatusesLoading}
            options={projectStatuses.map(status => ({
              value: status.name,
              label: getStatusLabel(status.name),
            }))}
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
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
};

export default ProjectsPage;