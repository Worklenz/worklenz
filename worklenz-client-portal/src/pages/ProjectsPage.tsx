import React, { useEffect, useState } from 'react';
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
import { 
  EyeOutlined, 
  SearchOutlined,
  ProjectOutlined,
  CalendarOutlined,
  TeamOutlined
} from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import clientPortalAPI from '@/services/api';
import { ClientProject } from '@/types';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

const ProjectsPage: React.FC = () => {
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

  const fetchProjects = async (page = 1, pageSize = 10, search = '', status = '') => {
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
        setError('Failed to load projects');
      }
    } catch (err) {
      setError('Failed to load projects. Please try again later.');
      console.error('Projects API error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleTableChange = (paginationInfo: any, _filtersInfo: any, _sorter: any) => {
    fetchProjects(
      paginationInfo.current,
      paginationInfo.pageSize,
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

  const columns = [
    {
      title: 'Project Name',
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ClientProject) => (
        <Tag color={getStatusColor(status)} style={{ color: record.status_color }}>
          {status}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Completed', value: 'Completed' },
        { text: 'On Hold', value: 'On Hold' },
        { text: 'Cancelled', value: 'Cancelled' },
        { text: 'Planning', value: 'Planning' },
      ],
    },
    {
      title: 'Progress',
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
              {record.completed_tasks} / {record.total_tasks} tasks
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Client',
      dataIndex: 'client_name',
      key: 'client_name',
      render: (text: string) => (
        <Space>
          <TeamOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: 'Last Updated',
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
      title: 'Actions',
      key: 'actions',
      render: (record: ClientProject) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/projects/${record.id}`)}
          size="small"
        >
          View Details
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <Alert
        message="Error"
        description={error}
        type="error"
        showIcon
        action={
          <Button onClick={() => fetchProjects()}>
            Try Again
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <Title level={2}>
        <ProjectOutlined /> Projects
      </Title>
      <p>Manage and view your project progress</p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Search
              placeholder="Search projects..."
              allowClear
              onSearch={handleSearch}
              style={{ width: 250 }}
              prefix={<SearchOutlined />}
            />
            <Select
              placeholder="Filter by status"
              allowClear
              style={{ width: 150 }}
              onChange={handleStatusFilter}
              value={filters.status || undefined}
            >
              <Option value="Active">Active</Option>
              <Option value="Completed">Completed</Option>
              <Option value="On Hold">On Hold</Option>
              <Option value="Cancelled">Cancelled</Option>
              <Option value="Planning">Planning</Option>
            </Select>
          </Space>
        </Space>

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
              `${range[0]}-${range[1]} of ${total} projects`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default ProjectsPage;