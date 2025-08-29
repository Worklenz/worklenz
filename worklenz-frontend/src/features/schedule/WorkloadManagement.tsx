import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Progress,
  Tag,
  Button,
  Select,
  DatePicker,
  Slider,
  InputNumber,
  Space,
  Flex,
  Typography,
  Tooltip,
  Modal,
  Form,
  Input,
  message,
} from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  useFetchMemberWorkloadQuery,
  useUpdateResourceAllocationMutation,
  useRebalanceWorkloadMutation,
  useFetchResourceConflictsQuery,
  useFetchCapacityReportQuery,
} from '@/api/schedule/scheduleApi';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  UserOutlined,
  ProjectOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@/shared/antd-imports';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface WorkloadData {
  id: string;
  name: string;
  totalHours: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  projectCount: number;
  status: 'available' | 'normal' | 'fully-allocated' | 'overallocated';
  projects: Array<{
    id: string;
    name: string;
    allocatedHours: number;
    startDate?: string;
    endDate?: string;
  }>;
}

interface ResourceAllocationProps {
  memberId?: string;
  onClose?: () => void;
}

const WorkloadManagement: React.FC<ResourceAllocationProps> = ({ memberId, onClose }) => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();

  const { workingHours } = useAppSelector(state => state.scheduleReducer);
  const [selectedMember, setSelectedMember] = useState<string | undefined>(memberId);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [allocationForm] = Form.useForm();
  const [isAllocationModalVisible, setIsAllocationModalVisible] = useState(false);

  // RTK Query hooks with conditional fetching
  const {
    data: workloadResponse,
    isLoading: workloadLoading,
    refetch: refetchWorkload,
  } = useFetchMemberWorkloadQuery(
    {
      memberId: selectedMember || '',
      startDate: dateRange[0]?.toISOString() || dayjs().startOf('month').toISOString(),
      endDate: dateRange[1]?.toISOString() || dayjs().endOf('month').toISOString(),
    },
    {
      skip: !selectedMember && !memberId, // Skip query if no member is selected
    }
  );

  const { data: conflictsResponse, isLoading: conflictsLoading } = useFetchResourceConflictsQuery(
    undefined,
    {
      // Only fetch conflicts if we have workload data
      skip: workloadLoading || !workloadResponse,
    }
  );

  const [updateAllocation, { isLoading: updateLoading }] = useUpdateResourceAllocationMutation();
  const [rebalanceWorkload, { isLoading: rebalanceLoading }] = useRebalanceWorkloadMutation();

  const workloadData = workloadResponse?.body || [];
  const conflicts = conflictsResponse?.body || [];

  // Use RTK Query data directly with safety checks
  const processedWorkloadData: WorkloadData[] = useMemo(() => {
    if (!workloadData || workloadData.length === 0) {
      return [];
    }

    return workloadData.map((member: any) => ({
      ...member,
      conflicts: conflicts?.filter?.((conflict: any) => conflict.memberId === member.id) || [],
    }));
  }, [workloadData, conflicts]);

  const getStatusColor = (status: WorkloadData['status']) => {
    switch (status) {
      case 'available':
        return '#52c41a';
      case 'normal':
        return '#1890ff';
      case 'fully-allocated':
        return '#faad14';
      case 'overallocated':
        return '#f5222d';
      default:
        return '#d9d9d9';
    }
  };

  const getStatusText = (status: WorkloadData['status']) => {
    switch (status) {
      case 'available':
        return t('available') || 'Available';
      case 'normal':
        return t('normal') || 'Normal';
      case 'fully-allocated':
        return t('fullyAllocated') || 'Fully Allocated';
      case 'overallocated':
        return t('overAllocated') || 'Over Allocated';
      default:
        return t('unknown') || 'Unknown';
    }
  };

  // Table columns for workload overview
  const workloadColumns = [
    {
      title: t('member') || 'Member',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: WorkloadData) => (
        <Space>
          <UserOutlined />
          <Text strong>{name}</Text>
          <Tag color={getStatusColor(record.status)} size="small">
            {getStatusText(record.status)}
          </Tag>
        </Space>
      ),
    },
    {
      title: t('utilization') || 'Utilization',
      dataIndex: 'utilizationPercent',
      key: 'utilization',
      render: (percent: number, record: WorkloadData) => (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Progress
            percent={Math.min(percent, 100)}
            strokeColor={getStatusColor(record.status)}
            size="small"
            format={() => `${percent.toFixed(1)}%`}
          />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.allocatedHours}h / {record.totalHours}h
          </Text>
        </Space>
      ),
    },
    {
      title: t('projects') || 'Projects',
      dataIndex: 'projectCount',
      key: 'projects',
      render: (count: number) => (
        <Space>
          <ProjectOutlined />
          <Text>{count}</Text>
        </Space>
      ),
    },
    {
      title: t('available') || 'Available',
      dataIndex: 'availableHours',
      key: 'available',
      render: (hours: number) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{hours}h</Text>
        </Space>
      ),
    },
    {
      title: t('actions') || 'Actions',
      key: 'actions',
      render: (_: any, record: WorkloadData) => (
        <Space>
          <Button size="small" onClick={() => handleEditAllocation(record.id)}>
            {t('manage') || 'Manage'}
          </Button>
          <Button size="small" type="link" onClick={() => handleRebalance(record.id)}>
            {t('rebalance') || 'Rebalance'}
          </Button>
        </Space>
      ),
    },
  ];

  // Project allocation columns for selected member
  const projectColumns = [
    {
      title: t('project') || 'Project',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <ProjectOutlined />
          <Text>{name}</Text>
        </Space>
      ),
    },
    {
      title: t('allocatedHours') || 'Allocated Hours',
      dataIndex: 'allocatedHours',
      key: 'allocatedHours',
      render: (hours: number, record: any) => (
        <InputNumber
          min={0}
          max={workingHours}
          value={hours}
          onChange={value => handleHoursChange(record.id, value || 0)}
          addonAfter="h"
          size="small"
        />
      ),
    },
    {
      title: t('percentage') || 'Percentage',
      key: 'percentage',
      render: (_: any, record: any) => (
        <Text>{((record.allocatedHours / workingHours) * 100).toFixed(1)}%</Text>
      ),
    },
    {
      title: t('duration') || 'Duration',
      key: 'duration',
      render: (_: any, record: any) => (
        <Text type="secondary">
          {record.startDate && record.endDate
            ? `${dayjs(record.startDate).format('MMM DD')} - ${dayjs(record.endDate).format('MMM DD')}`
            : t('notSet') || 'Not set'}
        </Text>
      ),
    },
  ];

  const handleEditAllocation = useCallback((memberId: string) => {
    setSelectedMember(memberId);
    setIsAllocationModalVisible(true);
  }, []);

  const handleRebalance = useCallback(
    (memberId: string) => {
      Modal.confirm({
        title: t('rebalanceWorkload') || 'Rebalance Workload',
        icon: <ExclamationCircleOutlined />,
        content:
          t('rebalanceConfirm') ||
          'This will automatically redistribute tasks to optimize workload. Continue?',
        onOk: async () => {
          try {
            await rebalanceWorkload({
              memberIds: [memberId],
              strategy: 'even',
              maxUtilization: 100,
            }).unwrap();
            message.success(t('workloadRebalanced') || 'Workload rebalanced successfully');
            refetchWorkload();
          } catch (error) {
            message.error(t('rebalanceError') || 'Failed to rebalance workload');
          }
        },
      });
    },
    [rebalanceWorkload, refetchWorkload, t]
  );

  const handleHoursChange = useCallback(
    async (projectId: string, hours: number) => {
      if (!selectedMember) return;

      try {
        await updateAllocation({
          memberId: selectedMember,
          projectId,
          allocatedHours: hours,
        }).unwrap();
        message.success(t('allocationUpdated') || 'Allocation updated successfully');
      } catch (error) {
        message.error(t('allocationError') || 'Failed to update allocation');
      }
    },
    [selectedMember, updateAllocation, t]
  );

  const selectedMemberData = useMemo(() => {
    return processedWorkloadData.find(member => member.id === selectedMember);
  }, [processedWorkloadData, selectedMember]);

  const renderWorkloadSummary = useCallback(() => {
    if (!processedWorkloadData || processedWorkloadData.length === 0) {
      return (
        <Flex gap={16} style={{ marginBottom: 24 }}>
          <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
            <Text type="secondary">{t('noDataAvailable') || 'No data available'}</Text>
          </Card>
        </Flex>
      );
    }

    const totalMembers = processedWorkloadData.length;
    const overallocated = processedWorkloadData.filter(m => m.status === 'overallocated').length;
    const fullyAllocated = processedWorkloadData.filter(m => m.status === 'fully-allocated').length;
    const available = processedWorkloadData.filter(m => m.status === 'available').length;

    return (
      <Flex gap={16} style={{ marginBottom: 24 }}>
        <Card size="small" style={{ flex: 1 }}>
          <Flex align="center" gap={8}>
            <UserOutlined style={{ color: '#1890ff' }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{totalMembers}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {t('totalMembers') || 'Total Members'}
              </div>
            </div>
          </Flex>
        </Card>

        <Card size="small" style={{ flex: 1 }}>
          <Flex align="center" gap={8}>
            <WarningOutlined style={{ color: '#f5222d' }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{overallocated}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {t('overAllocated') || 'Over Allocated'}
              </div>
            </div>
          </Flex>
        </Card>

        <Card size="small" style={{ flex: 1 }}>
          <Flex align="center" gap={8}>
            <ClockCircleOutlined style={{ color: '#faad14' }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{fullyAllocated}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {t('fullyAllocated') || 'Fully Allocated'}
              </div>
            </div>
          </Flex>
        </Card>

        <Card size="small" style={{ flex: 1 }}>
          <Flex align="center" gap={8}>
            <UserOutlined style={{ color: '#52c41a' }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{available}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{t('available') || 'Available'}</div>
            </div>
          </Flex>
        </Card>
      </Flex>
    );
  }, [processedWorkloadData, t]);

  return (
    <div style={{ padding: 0 }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('workloadManagement') || 'Workload Management'}
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            {t('refresh') || 'Refresh'}
          </Button>
        </Space>
      </Flex>

      {renderWorkloadSummary()}

      <Tabs defaultActiveKey="overview" type="card">
        <TabPane tab={t('overview') || 'Overview'} key="overview">
          <Table
            dataSource={processedWorkloadData}
            columns={workloadColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ y: 400 }}
            loading={workloadLoading}
          />
        </TabPane>

        <TabPane tab={t('allocation') || 'Resource Allocation'} key="allocation">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Flex gap={16} align="center">
              <Text strong>{t('selectMember') || 'Select Member'}:</Text>
              <Select
                value={selectedMember}
                onChange={setSelectedMember}
                style={{ width: 200 }}
                placeholder={t('chooseMember') || 'Choose member'}
                loading={workloadLoading}
                allowClear
              >
                {processedWorkloadData &&
                  processedWorkloadData.length > 0 &&
                  processedWorkloadData.map(member => (
                    <Option key={member.id} value={member.id}>
                      {member.name} ({member.utilizationPercent?.toFixed?.(0) || 0}%)
                    </Option>
                  ))}
              </Select>
            </Flex>

            {selectedMemberData && (
              <Card size="small">
                <Flex gap={24} align="center" style={{ marginBottom: 16 }}>
                  <div>
                    <Text strong style={{ fontSize: '16px' }}>
                      {selectedMemberData.name}
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag color={getStatusColor(selectedMemberData.status)}>
                        {getStatusText(selectedMemberData.status)}
                      </Tag>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text type="secondary">{t('utilization') || 'Utilization'}</Text>
                    <Progress
                      percent={Math.min(selectedMemberData.utilizationPercent, 100)}
                      strokeColor={getStatusColor(selectedMemberData.status)}
                      format={() => `${selectedMemberData.utilizationPercent.toFixed(1)}%`}
                    />
                  </div>
                  <div>
                    <Text type="secondary">{t('capacity') || 'Capacity'}</Text>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      {selectedMemberData.allocatedHours}h / {selectedMemberData.totalHours}h
                    </div>
                  </div>
                </Flex>

                <Table
                  dataSource={selectedMemberData.projects}
                  columns={projectColumns}
                  rowKey="id"
                  size="small"
                  pagination={false}
                />
              </Card>
            )}
          </Space>
        </TabPane>

        <TabPane tab={t('balancing') || 'Load Balancing'} key="balancing">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card>
              <Title level={5}>{t('autoBalancing') || 'Automatic Load Balancing'}</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                {t('autoBalancingDesc') ||
                  'Automatically redistribute workload across team members to optimize resource utilization.'}
              </Text>

              <Space>
                <Button type="primary" icon={<ReloadOutlined />}>
                  {t('rebalanceAll') || 'Rebalance All'}
                </Button>
                <Button>{t('previewChanges') || 'Preview Changes'}</Button>
              </Space>
            </Card>

            <Card>
              <Title level={5}>{t('balancingRules') || 'Balancing Rules'}</Title>
              <Form layout="vertical">
                <Form.Item label={t('maxUtilization') || 'Maximum Utilization (%)'}>
                  <Slider
                    min={50}
                    max={120}
                    defaultValue={100}
                    marks={{
                      50: '50%',
                      75: '75%',
                      100: '100%',
                      120: '120%',
                    }}
                  />
                </Form.Item>

                <Form.Item label={t('balancingStrategy') || 'Balancing Strategy'}>
                  <Select defaultValue="even" style={{ width: 200 }}>
                    <Option value="even">{t('evenDistribution') || 'Even Distribution'}</Option>
                    <Option value="skills">{t('skillsBased') || 'Skills Based'}</Option>
                    <Option value="priority">{t('priorityBased') || 'Priority Based'}</Option>
                  </Select>
                </Form.Item>
              </Form>
            </Card>
          </Space>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default WorkloadManagement;
