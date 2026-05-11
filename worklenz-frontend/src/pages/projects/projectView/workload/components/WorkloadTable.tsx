import { useState, useMemo } from 'react';
import {
  Table,
  Avatar,
  Progress,
  Tag,
  Button,
  Flex,
  Tooltip,
  Typography,
  Space,
  Dropdown,
  Modal,
  Form,
  InputNumber,
  theme,
} from '@/shared/antd-imports';
import { MoreOutlined, SwapOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { IWorkloadData, IWorkloadMember, ITaskAllocation } from '@/types/workload/workload.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { formatTime } from '@/api/project-workload/project-workload.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';

import { setSelectedMember } from '@/features/project-workload/projectWorkloadSlice';
import { ColumnsType } from 'antd/es/table';

// Helper function to calculate working days per week from organization settings
const calculateWorkingDaysFromOrgSettings = (workingDays: any): number => {
  if (!workingDays) return 5;
  const days = {
    monday: workingDays.monday || false,
    tuesday: workingDays.tuesday || false,
    wednesday: workingDays.wednesday || false,
    thursday: workingDays.thursday || false,
    friday: workingDays.friday || false,
    saturday: workingDays.saturday || false,
    sunday: workingDays.sunday || false,
  };
  return Object.values(days).filter(Boolean).length;
};

// Helper function to calculate working days in a date range
const calculateWorkingDaysInPeriod = (
  startDate: string,
  endDate: string,
  workingDaysConfig: any
): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) return 0;

  const workingDays = workingDaysConfig || {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  };

  const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  let workingDaysCount = 0;
  let currentDate = new Date(start);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    const dayName = dayMapping[dayOfWeek];
    if (workingDays[dayName]) {
      workingDaysCount++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDaysCount;
};

// Helper function to calculate workload from tasks for a specific date range
const calculateWorkloadFromTasks = (tasks: any[], startDate?: string, endDate?: string): number => {
  if (!Array.isArray(tasks)) return 0;

  let totalHours = 0;

  let startOfPeriod: Date;
  let endOfPeriod: Date;

  if (startDate && endDate) {
    startOfPeriod = new Date(startDate);
    endOfPeriod = new Date(endDate);
  } else {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    startOfPeriod = new Date(currentYear, currentMonth, 1);
    endOfPeriod = new Date(currentYear, currentMonth + 2, 0);
  }

  tasks.forEach(task => {
    if (task?.start_date && task?.end_date) {
      const startDate = new Date(task.start_date);
      const endDate = new Date(task.end_date);

      if (startDate <= endOfPeriod && endDate >= startOfPeriod) {
        const overlapStart = new Date(Math.max(startDate.getTime(), startOfPeriod.getTime()));
        const overlapEnd = new Date(Math.min(endDate.getTime(), endOfPeriod.getTime()));
        const overlapDays = Math.max(
          1,
          Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24))
        );
        const baseHours = Math.min(6, Math.max(3, overlapDays * 0.5));
        totalHours += baseHours;
      }
    } else if (task?.end_date) {
      const endDate = new Date(task.end_date);
      if (endDate >= startOfPeriod && endDate <= endOfPeriod) {
        totalHours += 4;
      }
    } else if (!task?.start_date && !task?.end_date) {
      totalHours += 2;
    }
  });

  if (totalHours === 0 && tasks.length > 0) {
    totalHours = Math.min(20, tasks.length * 2);
  }

  return Math.round(totalHours);
};

// Export workload data as CSV
const exportWorkloadAsCSV = (member: IWorkloadMember, tasks: any[], t: (key: string) => string) => {
  const headers = ['Task Name', 'Start Date', 'End Date', 'Priority', 'Status', 'Progress (%)'];

  const rows = tasks.map(task => [
    task.name || `Task ${task.id || ''}`,
    task.start_date ? task.start_date.split('T')[0] : '',
    task.end_date ? task.end_date.split('T')[0] : '',
    task.priority_value || 'Normal',
    task.status_name || '',
    task.complete_ratio || 0,
  ]);

  const csvContent = [
    // Member summary rows
    [`Member: ${member.name}`],
    [`Email: ${member.email}`],
    [`Capacity: ${formatTime(member.expectedCapacity)}`],
    [`Allocated: ${formatTime(member.currentWorkload)}`],
    [`Utilization: ${member.utilizationPercentage}%`],
    [`Status: ${member.isOverallocated ? 'Overallocated' : member.isUnderutilized ? 'Underutilized' : 'Optimal'}`],
    [],
    headers,
    ...rows,
  ]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `workload-${member.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface WorkloadTableProps {
  data: IWorkloadData | any;
}

const WorkloadTable = ({ data }: WorkloadTableProps) => {
  const { t } = useTranslation('workload');
  const dispatch = useAppDispatch();
  const { capacityUnit, alertThresholds, dateRange } = useAppSelector(
    state => state.projectWorkload
  );
  const { token } = theme.useToken();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  // ── Reassign modal state ──────────────────────────────────────────────────
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ITaskAllocation | null>(null);

  // ── FIX 1: View Details modal state ──────────────────────────────────────
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [detailsMember, setDetailsMember] = useState<IWorkloadMember | null>(null);

  // ── FIX 2: Adjust Capacity modal state ───────────────────────────────────
  const [adjustCapacityModalVisible, setAdjustCapacityModalVisible] = useState(false);
  const [adjustMember, setAdjustMember] = useState<IWorkloadMember | null>(null);
  const [capacityForm] = Form.useForm();

  // ─────────────────────────────────────────────────────────────────────────

  // Transform raw API response to expected format
  const workloadMembers = useMemo(() => {
    if (data?.members && Array.isArray(data.members)) {
      return data.members;
    }

    const members = data?.body || [];
    if (!Array.isArray(members)) return [];

    return members.map((member: any) => {
      const dailyHours = Number(member.org_working_hours) || 8;
      const workingDaysPerWeek = calculateWorkingDaysFromOrgSettings(member.org_working_days) || 5;
      const weeklyCapacity = dailyHours * workingDaysPerWeek;
      const currentWorkload =
        calculateWorkloadFromTasks(member.tasks, dateRange.startDate, dateRange.endDate) || 0;

      const startDate = dateRange.startDate || new Date().toISOString().split('T')[0];
      const endDate = dateRange.endDate || new Date().toISOString().split('T')[0];
      const workingDaysInPeriod = calculateWorkingDaysInPeriod(
        startDate,
        endDate,
        member.org_working_days
      );
      let periodCapacity = workingDaysInPeriod * dailyHours;
      if (periodCapacity === 0) periodCapacity = weeklyCapacity;

      const utilizationPercentage =
        periodCapacity > 0 ? Math.round((currentWorkload / periodCapacity) * 100) : 0;

      return {
        id: member.project_member_id || member.team_member_id || member.user_id,
        name: member.name || t('table.unknown'),
        email: member.email || '',
        avatar: member.avatar_url,
        role: member.role,
        teamId: member.team_member_id,
        dailyCapacity: dailyHours,
        weeklyCapacity: weeklyCapacity,
        expectedCapacity: periodCapacity,
        currentWorkload: currentWorkload,
        utilizationPercentage: utilizationPercentage,
        isOverallocated: utilizationPercentage > 100,
        isUnderutilized: utilizationPercentage < 50,
      };
    });
  }, [data, dateRange.startDate, dateRange.endDate]);

  // ── FIX 1: Handler — View Details ─────────────────────────────────────────
  const handleViewDetails = (record: IWorkloadMember) => {
    dispatch(setSelectedMember(record.id)); // keep Redux state in sync
    setDetailsMember(record);
    setDetailsModalVisible(true);
  };

  // ── FIX 2: Handler — Adjust Capacity ─────────────────────────────────────
  const handleAdjustCapacity = (record: IWorkloadMember) => {
    setAdjustMember(record);
    capacityForm.setFieldsValue({ dailyCapacity: record.dailyCapacity });
    setAdjustCapacityModalVisible(true);
  };

  const handleAdjustCapacitySave = () => {
    capacityForm
      .validateFields()
      .then(values => {
        // TODO: dispatch an action / call API to persist the new capacity value
        // e.g. dispatch(updateMemberCapacity({ memberId: adjustMember!.id, dailyCapacity: values.dailyCapacity }))
        console.log('New daily capacity for', adjustMember?.name, ':', values.dailyCapacity, 'h');
        setAdjustCapacityModalVisible(false);
        setAdjustMember(null);
        capacityForm.resetFields();
      })
      .catch(() => {});
  };

  // ── FIX 3: Handler — Export Workload ─────────────────────────────────────
  const handleExportWorkload = (record: IWorkloadMember) => {
    const memberData = data?.body?.find(
      (m: any) => (m.project_member_id || m.team_member_id || m.user_id) === record.id
    );
    const tasks = memberData?.tasks || [];
    exportWorkloadAsCSV(record, tasks, t);
  };

  // ─────────────────────────────────────────────────────────────────────────

  const columns: ColumnsType<IWorkloadMember> = [
    {
      title: t('table.member'),
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (name, record) => (
        <Flex align="center" gap={8}>
          <Avatar src={record.avatar} size={32}>
            {name.charAt(0).toUpperCase()}
          </Avatar>
          <Flex vertical>
            <Typography.Text strong>{name}</Typography.Text>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, color: token.colorTextSecondary }}
            >
              {record.role || record.email}
            </Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: t('table.capacity'),
      dataIndex: 'expectedCapacity',
      key: 'capacity',
      width: 120,
      render: (capacity, record) => {
        const workingDays =
          record.dailyCapacity > 0 ? Math.round(record.weeklyCapacity / record.dailyCapacity) : 5;
        return (
          <Tooltip
            title={t('calculations.capacityTooltip', {
              weeklyCapacity: capacity,
              dailyHours: record.dailyCapacity,
              workingDays,
            })}
            placement="top"
          >
            <Typography.Text>{formatTime(capacity)}</Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: t('table.allocated'),
      dataIndex: 'currentWorkload',
      key: 'allocated',
      width: 120,
      render: (workload, record) => (
        <Flex vertical gap={4}>
          <Typography.Text>{formatTime(workload)}</Typography.Text>
          {record.isOverallocated && (
            <Tag
              color="red"
              style={{
                fontSize: 10,
                backgroundColor: token.colorErrorBg,
                borderColor: token.colorError,
              }}
            >
              +{workload - record.expectedCapacity}
            </Tag>
          )}
        </Flex>
      ),
    },
    {
      title: t('table.utilization'),
      dataIndex: 'utilizationPercentage',
      key: 'utilization',
      width: 180,
      sorter: (a, b) => a.utilizationPercentage - b.utilizationPercentage,
      render: (utilization, record) => {
        const status =
          utilization > alertThresholds.overallocation
            ? 'exception'
            : utilization < alertThresholds.underutilization
              ? 'normal'
              : 'success';
        const workingDays =
          record.dailyCapacity > 0 ? Math.round(record.weeklyCapacity / record.dailyCapacity) : 5;
        return (
          <Tooltip
            title={t('calculations.utilizationTooltip', {
              utilization,
              assignedHours: record.currentWorkload,
              weeklyCapacity: record.expectedCapacity,
              dailyHours: record.dailyCapacity,
              workingDays,
            })}
            placement="top"
          >
            <Flex vertical gap={4}>
              <Progress
                percent={utilization}
                size="small"
                status={status}
                format={percent => `${percent}%`}
              />
            </Flex>
          </Tooltip>
        );
      },
    },
    {
      title: t('table.status'),
      key: 'status',
      width: 120,
      render: (_, record) => {
        const getStatusTooltip = () => {
          if (record.isOverallocated) return t('calculations.statusTooltip.overallocated');
          if (record.isUnderutilized)
            return t('calculations.statusTooltip.underutilized', {
              threshold: alertThresholds.underutilization,
            });
          return t('calculations.statusTooltip.optimal', {
            threshold: alertThresholds.underutilization,
          });
        };

        if (record.isOverallocated) {
          return (
            <Tooltip title={getStatusTooltip()} placement="top">
              <Tag
                style={{
                  backgroundColor: token.colorErrorBg,
                  borderColor: token.colorError,
                  color: token.colorError,
                }}
              >
                {t('status.overallocated')}
              </Tag>
            </Tooltip>
          );
        }
        if (record.isUnderutilized) {
          return (
            <Tooltip title={getStatusTooltip()} placement="top">
              <Tag
                style={{
                  backgroundColor: token.colorWarningBg,
                  borderColor: token.colorWarning,
                  color: token.colorWarning,
                }}
              >
                {t('status.underutilized')}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={getStatusTooltip()} placement="top">
            <Tag
              style={{
                backgroundColor: token.colorSuccessBg,
                borderColor: token.colorSuccess,
                color: token.colorSuccess,
              }}
            >
              {t('status.optimal')}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('table.assignedTasks'),
      key: 'tasks',
      width: 100,
      render: (_, record) => {
        const memberData = data?.body?.find(
          (m: any) => (m.project_member_id || m.team_member_id || m.user_id) === record.id
        );
        const tasksCount = memberData?.tasks?.length || 0;
        return (
          <Typography.Text>
            {tasksCount} {t('table.tasks')}
          </Typography.Text>
        );
      },
    },
    {
      title: t('table.actions'),
      key: 'actions',
      fixed: 'right',
      width: 80,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'view',
                label: t('actions.viewDetails'),
                icon: <EditOutlined />,
                // ── FIX 1: was only dispatching Redux action with no visible effect ──
                onClick: () => handleViewDetails(record),
              },
              {
                key: 'adjust',
                label: t('actions.adjustCapacity'),
                icon: <EditOutlined />,
                // ── FIX 2: was missing onClick entirely ──
                onClick: () => handleAdjustCapacity(record),
              },
              {
                key: 'reassign',
                label: t('actions.reassignTasks'),
                icon: <SwapOutlined />,
                disabled: (() => {
                  const memberData = data?.body?.find(
                    (m: any) =>
                      (m.project_member_id || m.team_member_id || m.user_id) === record.id
                  );
                  return !memberData?.tasks?.length;
                })(),
              },
              { type: 'divider' },
              {
                key: 'export',
                label: t('actions.exportWorkload'),
                icon: <ExportOutlined />,
                // ── FIX 3: was missing onClick entirely ──
                onClick: () => handleExportWorkload(record),
              },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const expandedRowRender = (record: IWorkloadMember) => {
    const memberData = data?.body?.find(
      (m: any) => (m.project_member_id || m.team_member_id || m.user_id) === record.id
    );
    const memberTasks = memberData?.tasks || [];

    const taskColumns: ColumnsType<any> = [
      {
        title: t('table.taskName'),
        key: 'taskName',
        render: (_, task) => (
          <Typography.Text ellipsis style={{ maxWidth: 300 }}>
            {task.name || `${t('calendar.task')} ${task.id || t('table.unknown')}`}
          </Typography.Text>
        ),
      },
      {
        title: t('table.project'),
        key: 'projectName',
        render: (_, task) => (
          <Typography.Text>{task.project_name || t('table.currentProject')}</Typography.Text>
        ),
      },
      {
        title: t('table.duration'),
        key: 'duration',
        render: (_, task) => (
          <Typography.Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {task.start_date ? task.start_date.split('T')[0] : t('table.noStart')} -{' '}
            {task.end_date ? task.end_date.split('T')[0] : t('table.noEnd')}
          </Typography.Text>
        ),
      },
      {
        title: t('table.estimatedHours'),
        key: 'estimatedHours',
        render: (_, task) => {
          const hours = task.total_minutes ? task.total_minutes / 60 : 4;
          return formatTime(hours);
        },
      },
      {
        title: t('table.priority'),
        key: 'priority',
        render: (_, task) => (
          <Tag color={task.priority_color || 'default'}>
            {task.priority_value || t('table.defaultPriority')}
          </Tag>
        ),
      },
      {
        title: t('table.status'),
        key: 'status',
        render: (_, task) => (
          <Tag color={task.status_color || 'default'}>
            {task.status_name || t('table.defaultStatus')}
          </Tag>
        ),
      },
      {
        title: t('table.progress'),
        key: 'progress',
        render: (_, task) => (
          <Progress percent={task.complete_ratio || 0} size="small" style={{ width: 60 }} />
        ),
      },
      {
        title: '',
        key: 'taskActions',
        width: 80,
        render: (_, task) => (
          <Button
            type="text"
            size="small"
            icon={<SwapOutlined />}
            onClick={() => {
              const transformedTask = {
                id: task.id,
                taskId: task.id,
                taskName: task.name || `${t('calendar.task')} ${task.id}`,
                projectId: task.project_id,
                projectName: task.project_name || t('table.currentProject'),
                memberId: record.id,
                memberName: record.name,
                estimatedHours: task.total_minutes ? task.total_minutes / 60 : 4,
                actualHours: 0,
                startDate: task.start_date ? task.start_date.split('T')[0] : '',
                endDate: task.end_date ? task.end_date.split('T')[0] : '',
                priority: task.priority_value || t('table.defaultPriority'),
                priorityColor: task.priority_color || 'default',
                status: task.status_name || t('table.defaultStatus'),
                statusColor: task.status_color || 'default',
                completionPercentage: task.complete_ratio || 0,
              };
              setSelectedTask(transformedTask);
              setReassignModalVisible(true);
            }}
          >
            {t('actions.reassign')}
          </Button>
        ),
      },
    ];

    return (
      <Table
        columns={taskColumns}
        dataSource={memberTasks}
        rowKey={task => task.id || `task-${Math.random()}`}
        pagination={false}
        size="small"
      />
    );
  };

  const handleExpand = (expanded: boolean, record: IWorkloadMember) => {
    if (expanded) {
      setExpandedRowKeys([...expandedRowKeys, record.id]);
    } else {
      setExpandedRowKeys(expandedRowKeys.filter(key => key !== record.id));
    }
  };

  return (
    <>
      <Table
        columns={columns}
        dataSource={workloadMembers}
        rowKey="id"
        expandable={{
          expandedRowKeys,
          onExpand: handleExpand,
          expandedRowRender,
        }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: total => t('table.totalMembers', { total }),
        }}
        scroll={{ x: 1200 }}
      />

      {/* ── FIX 1: View Details Modal ───────────────────────────────────────── */}
      <Modal
        title={t('actions.viewDetails')}
        open={detailsModalVisible}
        onCancel={() => {
          setDetailsModalVisible(false);
          setDetailsMember(null);
          dispatch(setSelectedMember(null));
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setDetailsModalVisible(false);
              setDetailsMember(null);
              dispatch(setSelectedMember(null));
            }}
          >
            {t('common.cancel')}
          </Button>,
        ]}
      >
        {detailsMember && (
          <Flex vertical gap={16}>
            <Flex align="center" gap={12}>
              <Avatar src={detailsMember.avatar} size={48}>
                {detailsMember.name.charAt(0).toUpperCase()}
              </Avatar>
              <Flex vertical>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {detailsMember.name}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {detailsMember.role || detailsMember.email}
                </Typography.Text>
              </Flex>
            </Flex>

            <Flex justify="space-between">
              <Flex vertical>
                <Typography.Text type="secondary">{t('table.capacity')}</Typography.Text>
                <Typography.Text strong>{formatTime(detailsMember.expectedCapacity)}</Typography.Text>
              </Flex>
              <Flex vertical>
                <Typography.Text type="secondary">{t('table.allocated')}</Typography.Text>
                <Typography.Text strong>{formatTime(detailsMember.currentWorkload)}</Typography.Text>
              </Flex>
              <Flex vertical>
                <Typography.Text type="secondary">{t('table.utilization')}</Typography.Text>
                <Typography.Text strong>{detailsMember.utilizationPercentage}%</Typography.Text>
              </Flex>
            </Flex>

            <div>
              <Typography.Text type="secondary">{t('table.status')}</Typography.Text>
              <div style={{ marginTop: 4 }}>
                {detailsMember.isOverallocated ? (
                  <Tag color="error">{t('status.overallocated')}</Tag>
                ) : detailsMember.isUnderutilized ? (
                  <Tag color="warning">{t('status.underutilized')}</Tag>
                ) : (
                  <Tag color="success">{t('status.optimal')}</Tag>
                )}
              </div>
            </div>

            <div>
              <Progress
                percent={detailsMember.utilizationPercentage}
                status={
                  detailsMember.isOverallocated
                    ? 'exception'
                    : detailsMember.isUnderutilized
                      ? 'normal'
                      : 'success'
                }
              />
            </div>
          </Flex>
        )}
      </Modal>

      {/* ── FIX 2: Adjust Capacity Modal ────────────────────────────────────── */}
      <Modal
        title={t('actions.adjustCapacity')}
        open={adjustCapacityModalVisible}
        onCancel={() => {
          setAdjustCapacityModalVisible(false);
          setAdjustMember(null);
          capacityForm.resetFields();
        }}
        onOk={handleAdjustCapacitySave}
        okText={t('common.save', 'Save')}
        cancelText={t('common.cancel')}
      >
        {adjustMember && (
          <Flex vertical gap={16}>
            <Flex align="center" gap={8}>
              <Avatar src={adjustMember.avatar} size={32}>
                {adjustMember.name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography.Text strong>{adjustMember.name}</Typography.Text>
            </Flex>

            <Form form={capacityForm} layout="vertical">
              <Form.Item
                name="dailyCapacity"
                label={t('table.capacity', 'Daily Capacity (hours)')}
                rules={[
                  { required: true, message: 'Please enter a capacity value' },
                  { type: 'number', min: 1, max: 24, message: 'Must be between 1 and 24 hours' },
                ]}
              >
                <InputNumber min={1} max={24} step={0.5} style={{ width: '100%' }} addonAfter="h" />
              </Form.Item>
            </Form>

            <Typography.Text type="secondary">
              Current capacity: {formatTime(adjustMember.expectedCapacity)}
            </Typography.Text>
          </Flex>
        )}
      </Modal>

      {/* Reassign Task Modal (unchanged) */}
      <Modal
        title={t('modal.reassignTask')}
        open={reassignModalVisible}
        onCancel={() => {
          setReassignModalVisible(false);
          setSelectedTask(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => setReassignModalVisible(false)}>
            {t('common.cancel')}
          </Button>,
          <Button key="reassign" type="primary">
            {t('actions.reassign')}
          </Button>,
        ]}
      >
        {selectedTask && (
          <Flex vertical gap={16}>
            <div>
              <Typography.Text type="secondary">{t('modal.task')}</Typography.Text>
              <Typography.Title level={5}>{selectedTask.taskName}</Typography.Title>
            </div>
            <div>
              <Typography.Text type="secondary">{t('modal.currentAssignee')}</Typography.Text>
              <Typography.Text block>{selectedTask.memberName}</Typography.Text>
            </div>
          </Flex>
        )}
      </Modal>
    </>
  );
};

export default WorkloadTable;