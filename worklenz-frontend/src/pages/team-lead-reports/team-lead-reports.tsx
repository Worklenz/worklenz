import React, { useCallback, useEffect, useState } from 'react';
import { Card, Table, Typography, Spin, Alert, Avatar, Tag, Space, DatePicker, Row, Col, Statistic, Button, Modal, Pagination, Dropdown, List, Divider, Flex, theme, CheckCircleOutlined, Tooltip } from '@/shared/antd-imports';
import { UserOutlined, ClockCircleOutlined, ProjectOutlined, CalendarOutlined, EyeOutlined, DownOutlined, InfoCircleOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { teamLeadReportsApiService, TeamMember, TimeLogsSummary, DetailedTimeLog, PerformanceStats } from '@/api/team-lead-reports/team-lead-reports.api.service';
import { getRoleColor } from '@/types/roles/role.types';
import { formatSecondsToCompactHoursMinutes } from '@/utils/time-format.utils';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const TeamLeadReports: React.FC = () => {
  const { t } = useTranslation('team-lead-reports');
  const { token } = theme.useToken();
  
  // State management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [timeLogsSummary, setTimeLogsSummary] = useState<TimeLogsSummary[]>([]);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRangeLoading, setDateRangeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  // Date picker state
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<string>('thisWeek');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  
  // Modal state for detailed time logs
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [detailedLogs, setDetailedLogs] = useState<DetailedTimeLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [logsPagination, setLogsPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await teamLeadReportsApiService.getMyTeamMembers();
      if (response.done) {
        setTeamMembers(response.body);
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
      setError('Failed to fetch team members');
    }
  }, []);

  // Fetch time logs summary
  const fetchTimeLogsSummary = useCallback(async () => {
    if (!dateRange) return;
    
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      
      const response = await teamLeadReportsApiService.getTeamTimeLogsSummary(startDate, endDate);
      if (response.done) {
        setTimeLogsSummary(response.body);
      }
    } catch (err) {
      console.error('Error fetching time logs summary:', err);
      setError('Failed to fetch time logs summary');
    }
  }, [dateRange]);

  // Fetch performance stats
  const fetchPerformanceStats = useCallback(async () => {
    if (!dateRange) return;
    
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      
      const response = await teamLeadReportsApiService.getTeamPerformanceStats(startDate, endDate);
      if (response.done) {
        setPerformanceStats(response.body);
      }
    } catch (err) {
      console.error('Error fetching performance stats:', err);
      setError('Failed to fetch performance stats');
    }
  }, [dateRange]);

  // Fetch detailed time logs for a member
  const fetchDetailedLogs = useCallback(async (memberId: string, page: number = 1) => {
    if (!memberId) return;
    
    try {
      setLogsLoading(true);
      const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
      const endDate = dateRange?.[1]?.format('YYYY-MM-DD');
      
      const response = await teamLeadReportsApiService.getMemberDetailedTimeLogs(
        memberId, 
        startDate, 
        endDate, 
        page, 
        logsPagination.pageSize
      );
      
      if (response.done) {
        setDetailedLogs(response.body.logs);
        setLogsPagination(prev => ({
          ...prev,
          current: response.body.pagination.page,
          total: response.body.pagination.total,
        }));
      }
    } catch (err) {
      console.error('Error fetching detailed logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [dateRange, logsPagination.pageSize]);

  // Initialize data
  // Initialize default date range
  useEffect(() => {
    // Set default date range to "This Week"
    const defaultStartDate = dayjs().startOf('week');
    const defaultEndDate = dayjs().endOf('week');
    setDateRange([defaultStartDate, defaultEndDate]);
  }, []);

  // Fetch data when date range changes
  useEffect(() => {
    if (!dateRange) return;

    const initializeData = async () => {
      // Use different loading states for initial load vs date range changes
      if (teamMembers.length === 0) {
        setLoading(true);
      } else {
        setDateRangeLoading(true);
      }
      setError(null);
      
      try {
        // Only fetch team members once (they don't depend on date range)
        if (teamMembers.length === 0) {
          await fetchTeamMembers();
        }
        
        // Fetch date-dependent data
        await Promise.all([
          fetchTimeLogsSummary(),
          fetchPerformanceStats(),
        ]);
      } catch (err) {
        setError(t('errors.failedToLoad'));
      } finally {
        setLoading(false);
        setDateRangeLoading(false);
      }
    };

    initializeData();
  }, [dateRange]); // Removed function dependencies to prevent unnecessary re-renders

  // Date range items with translations
  const dateRangeItems = [
    {
      key: 'today',
      label: 'today',
      dates: dayjs().format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD'),
    },
    {
      key: 'yesterday',
      label: 'yesterday',
      dates:
        dayjs().subtract(1, 'day').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    },
    {
      key: 'thisWeek',
      label: 'thisWeek',
      dates:
        dayjs().startOf('week').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().endOf('week').format('YYYY-MM-DD'),
    },
    {
      key: 'lastWeek',
      label: 'lastWeek',
      dates:
        dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD'),
    },
    {
      key: 'last7Days',
      label: 'last7Days',
      dates:
        dayjs().subtract(7, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD'),
    },
    {
      key: 'thisMonth',
      label: 'thisMonth',
      dates:
        dayjs().startOf('month').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().endOf('month').format('YYYY-MM-DD'),
    },
    {
      key: 'lastMonth',
      label: 'lastMonth',
      dates:
        dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
    },
    {
      key: 'last30Days',
      label: 'last30Days',
      dates:
        dayjs().subtract(30, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD'),
    },
    {
      key: 'last90Days',
      label: 'last90Days',
      dates:
        dayjs().subtract(90, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD'),
    },
  ];

  // Handle predefined date range selection
  const handleDurationSelect = (item: any) => {
    setSelectedTimeFrame(item.label);
    setCustomRange(null);
    const [startDate, endDate] = item.dates.split(' - ');
    setDateRange([dayjs(startDate), dayjs(endDate)]);
    setIsDateDropdownOpen(false);
  };

  // Handle custom date range change
  const handleCustomDateRangeChange = (dates: any) => {
    if (dates) {
      setSelectedTimeFrame('');
      setCustomRange([dates[0].$d.toString(), dates[1].$d.toString()]);
    } else {
      setCustomRange(null);
    }
  };

  // Apply custom date filter
  const applyCustomDateFilter = () => {
    if (customRange) {
      setSelectedTimeFrame('custom');
      setIsDateDropdownOpen(false);
      setDateRange([dayjs(customRange[0]), dayjs(customRange[1])]);
    }
  };

  // Get display label for date picker button
  const getDisplayLabel = () => {
    const f = 'MMM DD, YYYY';
    if (customRange && customRange.length === 2) {
      return `${dayjs(customRange[0]).format(f)} - ${dayjs(customRange[1]).format(f)}`;
    }
    if (selectedTimeFrame) {
      return t(`dateRange.${selectedTimeFrame}`);
    }
    return t('dateRange.thisWeek');
  };

  // Handle view detailed logs
  const handleViewDetailedLogs = (member: TeamMember) => {
    setSelectedMember(member);
    setLogsModalVisible(true);
    fetchDetailedLogs(member.managed_member_id, 1);
  };

  // Handle logs pagination
  const handleLogsPaginationChange = (page: number, pageSize: number) => {
    setLogsPagination(prev => ({ ...prev, current: page, pageSize }));
    if (selectedMember) {
      fetchDetailedLogs(selectedMember.managed_member_id, page);
    }
  };

  // Format time duration using shared utility
  const formatDuration = (seconds: number | string | null | undefined) => {
    const numSeconds = typeof seconds === 'number' ? seconds : parseFloat(seconds as string) || 0;
    return formatSecondsToCompactHoursMinutes(numSeconds);
  };

  // Time logs summary table columns
  const timeLogsColumns: ColumnsType<TimeLogsSummary> = [
    {
      title: 'Member',
      key: 'member',
      render: (_, record) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text strong>{record.managed_member_name}</Text>
        </Space>
      ),
    },
    {
      title: (
        <Space>
          Total Time
          <Tooltip title="Total time logged by this member during the selected date range. Includes all time entries across all projects and tasks.">
            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'total_time_minutes',
      key: 'total_time',
      render: (seconds: number | string | null | undefined) => (
        <Text strong style={{ color: '#1890ff' }}>
          {formatDuration(seconds)}
        </Text>
      ),
      sorter: (a, b) => (a.total_time_minutes || 0) - (b.total_time_minutes || 0),
    },
    {
      title: (
        <Space>
          Logs Count
          <Tooltip title="Total number of individual time log entries created by this member during the selected date range.">
            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'total_logs',
      key: 'total_logs',
      sorter: (a, b) => a.total_logs - b.total_logs,
    },
    {
      title: (
        <Space>
          Projects
          <Tooltip title="Number of distinct projects this member logged time on during the selected date range.">
            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'projects_worked_on',
      key: 'projects',
      sorter: (a, b) => a.projects_worked_on - b.projects_worked_on,
    },
    {
      title: (
        <Space>
          Active Days
          <Tooltip title="Number of distinct days this member logged time during the selected date range.">
            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'days_logged',
      key: 'days_logged',
      sorter: (a, b) => a.days_logged - b.days_logged,
    },
    {
      title: 'Last Activity',
      dataIndex: 'last_log_date',
      key: 'last_activity',
      render: (date: string) => date ? dayjs(date).format('MMM DD, YYYY') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const member = teamMembers.find(m => m.managed_member_id === record.managed_member_id);
        return member ? (
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetailedLogs(member)}
          >
            View Details
          </Button>
        ) : null;
      },
    },
  ];

  // Performance stats table columns
  const performanceColumns: ColumnsType<PerformanceStats> = [
    {
      title: 'Member',
      key: 'member',
      render: (_, record) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <Text strong>{record.managed_member_name}</Text>
            <br />
            <Tag color={getRoleColor(record.managed_member_role_name)}>
              {record.managed_member_role_name}
            </Tag>
          </div>
        </Space>
      ),
    },
    {
      title: 'Tasks',
      key: 'tasks',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Text>{record.assigned_tasks} assigned</Text>
          <Text type="success">{record.completed_tasks} completed</Text>
          {record.overdue_tasks > 0 && (
            <Text type="danger">{record.overdue_tasks} overdue</Text>
          )}
        </Space>
      ),
    },
    {
      title: (
        <Space>
          Completion Rate
          <Tooltip title="Percentage of completed tasks out of total assigned tasks. Calculated as: (Completed Tasks ÷ Assigned Tasks) × 100">
            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'completion_percentage',
      key: 'completion',
      render: (percentage: number | string | null | undefined) => {
        const numPercentage = typeof percentage === 'number' ? percentage : parseFloat(percentage as string) || 0;
        return (
          <Text style={{ color: numPercentage >= 80 ? '#52c41a' : numPercentage >= 60 ? '#faad14' : '#ff4d4f' }}>
            {numPercentage.toFixed(1)}%
          </Text>
        );
      },
      sorter: (a, b) => (a.completion_percentage || 0) - (b.completion_percentage || 0),
    },
    {
      title: (
        <Space>
          Time Logged
          <Tooltip title="Total time logged by this member during the selected date range. Includes all time entries across all projects and tasks.">
            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'total_time_minutes',
      key: 'time_logged',
      render: (seconds: number | string | null | undefined) => formatDuration(seconds),
      sorter: (a, b) => (a.total_time_minutes || 0) - (b.total_time_minutes || 0),
    },
    {
      title: (
        <Space>
          Active Projects
          <Tooltip title="Number of distinct projects this member logged time on during the selected date range.">
            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'active_projects',
      key: 'active_projects',
      sorter: (a, b) => a.active_projects - b.active_projects,
    },
  ];

  // Detailed logs table columns
  const detailedLogsColumns: ColumnsType<DetailedTimeLog> = [
    {
      title: 'Date & Time',
      dataIndex: 'logged_at',
      key: 'logged_at',
      render: (date: string) => (
        <div>
          <Text>{dayjs(date).format('MMM DD, YYYY')}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {dayjs(date).format('HH:mm')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'time_spent',
      key: 'duration',
      render: (minutes: number | string | null | undefined) => (
        <Text strong>{formatDuration(minutes)}</Text>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project_name',
      key: 'project',
    },
    {
      title: 'Task',
      dataIndex: 'task_name',
      key: 'task',
      render: (name: string) => (
        <Text style={{ maxWidth: 200 }} ellipsis={{ tooltip: name }}>
          {name}
        </Text>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '-',
    },
    {
      title: 'Method',
      dataIndex: 'logged_by_timer',
      key: 'method',
      render: (byTimer: boolean) => (
        <Tag color={byTimer ? 'green' : 'blue'}>
          {byTimer ? 'Timer' : 'Manual'}
        </Tag>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>{t('loading.fetchingData')}</Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message={t('errors.loadingError')}
        description={error}
        type="error"
        showIcon
        style={{ margin: 24 }}
      />
    );
  }

  // Calculate summary statistics
  const totalTeamMembers = teamMembers.length;
  
  // Calculate total time logged (values are in seconds, despite the field name)
  const totalTimeLogged = timeLogsSummary.reduce((sum, member) => {
    const timeValue = typeof member.total_time_minutes === 'string' 
      ? parseFloat(member.total_time_minutes) || 0 
      : member.total_time_minutes || 0;
    return sum + timeValue;
  }, 0);
  
  const totalProjects = Math.max(...timeLogsSummary.map(m => m.projects_worked_on), 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>
          <ClockCircleOutlined /> {t('title')}
        </Title>
        <Text type="secondary">
          {t('subtitle')}
        </Text>
      </div>

      {/* Date Range Filter */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="center">
          <Space>
            <CalendarOutlined />
            <Text>{t('dateRange.label')}:</Text>
            <Dropdown
              trigger={['click']}
              dropdownRender={() => (
                <Card
                  styles={{
                    body: {
                      padding: 0,
                      minWidth: 320,
                      maxHeight: 400,
                      overflowY: 'auto',
                    },
                  }}
                >
                  <List style={{ padding: 0 }}>
                    {dateRangeItems.map(item => (
                      <List.Item
                        key={item.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 24,
                          padding: '8px 12px',
                          backgroundColor:
                            selectedTimeFrame === item.label ? token.colorPrimaryBg : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleDurationSelect(item)}
                      >
                        <Text
                          style={{
                            color: selectedTimeFrame === item.label ? token.colorPrimary : 'inherit',
                          }}
                        >
                          {t(`dateRange.${item.label}`)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.dates
                            ? dayjs(item.dates.split(' - ')[0]).format('MMM DD, YYYY') +
                              ' - ' +
                              dayjs(item.dates.split(' - ')[1]).format('MMM DD, YYYY')
                            : ''}
                        </Text>
                      </List.Item>
                    ))}
                  </List>

                  <Divider style={{ marginBlock: 12 }} />

                  <Flex vertical gap={8} style={{ padding: 12 }}>
                    <Text>{t('dateRange.custom')}</Text>
                    <RangePicker
                      format={'MMM DD, YYYY'}
                      onChange={handleCustomDateRangeChange}
                      value={customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null}
                    />
                    <Button
                      type="primary"
                      size="small"
                      style={{ width: 'fit-content', alignSelf: 'flex-end' }}
                      onClick={applyCustomDateFilter}
                      disabled={!customRange}
                    >
                      {t('dateRange.apply')}
                    </Button>
                  </Flex>
                </Card>
              )}
              onOpenChange={open => setIsDateDropdownOpen(open)}
              open={isDateDropdownOpen}
            >
              <Button icon={<DownOutlined />} iconPosition="end">
                {getDisplayLabel()}
              </Button>
            </Dropdown>
          </Space>
          
          {/* Selected Date Range Display */}
          {dateRange && (
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('dateRange.showing')}:
              </Text>
              <Tag color="blue" style={{ margin: 0 }}>
                {dayjs(dateRange[0]).format('MMM DD, YYYY')} - {dayjs(dateRange[1]).format('MMM DD, YYYY')}
              </Tag>
              {dateRangeLoading && (
                <Spin size="small" />
              )}
            </Space>
          )}
        </Flex>
      </Card>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={
                <Space>
                  {t('summary.totalMembers')}
                  <Tooltip title="Total number of team members who have logged time during the selected date range.">
                    <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              }
              value={totalTeamMembers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={
                <Space>
                  {t('summary.totalTimeLogged')}
                  <Tooltip title="Total time logged by all team members during the selected date range.">
                    <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              }
              value={formatDuration(totalTimeLogged)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={
                <Space>
                  {t('summary.activeProjects')}
                  <Tooltip title="Maximum number of projects worked on by any single team member during the selected date range.">
                    <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              }
              value={totalProjects}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Time Logs Summary Table */}
      <Card 
        title={t('timeTracking.title')}
        style={{ marginBottom: 24 }}
        extra={<ClockCircleOutlined />}
      >
        <Table
          columns={timeLogsColumns}
          dataSource={timeLogsSummary}
          rowKey="managed_member_id"
          size="small"
          pagination={{ pageSize: 10 }}
          loading={loading || dateRangeLoading}
        />
      </Card>

      {/* Performance Stats Table */}
      <Card 
        title={t('performance.title')}
        extra={<CheckCircleOutlined />}
      >
        <Table
          columns={performanceColumns}
          dataSource={performanceStats}
          rowKey="managed_member_id"
          size="small"
          pagination={{ pageSize: 10 }}
          loading={loading || dateRangeLoading}
        />
      </Card>

      {/* Detailed Logs Modal */}
      <Modal
        title={`${t('detailedLogs.title')} ${t('detailedLogs.for')} ${selectedMember?.managed_member_name}`}
        open={logsModalVisible}
        onCancel={() => setLogsModalVisible(false)}
        width={1000}
        footer={null}
      >
        <Spin spinning={logsLoading}>
          <Table
            columns={detailedLogsColumns}
            dataSource={detailedLogs}
            rowKey="time_log_id"
            size="small"
            pagination={false}
          />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Pagination
              current={logsPagination.current}
              pageSize={logsPagination.pageSize}
              total={logsPagination.total}
              onChange={handleLogsPaginationChange}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) => 
                `${range[0]}-${range[1]} of ${total} time logs`
              }
            />
          </div>
        </Spin>
      </Modal>
    </div>
  );
};

export default TeamLeadReports;
