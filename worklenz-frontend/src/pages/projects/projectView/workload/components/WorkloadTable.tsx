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
  theme,
} from '@/shared/antd-imports';
import { MoreOutlined, EditOutlined, ExportOutlined, RightOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { IWorkloadData, IWorkloadMember, ITaskAllocation } from '@/types/workload/workload.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { formatTime, normalizeMemberTasks } from '@/api/project-workload/project-workload.api.service';
import { formatDate } from '@/utils/timeUtils';
import { useAppDispatch } from '@/hooks/useAppDispatch';

import { setSelectedMember } from '@/features/project-workload/projectWorkloadSlice';
import EmptyListPlaceholder from '@/components/EmptyListPlaceholder';
import { ColumnsType } from 'antd/es/table';
import { PAGE_SIZE_OPTIONS } from '@/shared/constants';

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
const exportWorkloadAsCSV = (
  member: IWorkloadMember,
  tasks: ITaskAllocation[],
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const headers = [
    t('table.taskName'),
    t('export.startDateHeader'),
    t('export.endDateHeader'),
    t('table.priority'),
    t('table.status'),
    t('export.progressHeader'),
  ];

  const rows = tasks.map(task => [
    task.taskName || t('export.taskFallback', { id: task.taskId || '' }),
    task.startDate || '',
    task.endDate || '',
    task.priority || t('export.defaultPriority'),
    task.status || '',
    task.completionPercentage || 0,
  ]);

  const statusLabel = member.isOverallocated
    ? t('status.overallocated')
    : member.isUnderutilized
      ? t('status.underutilized')
      : t('status.optimal');

  const csvContent = [
    // Member summary rows
    [t('export.memberLabel', { name: member.name })],
    [t('export.emailLabel', { email: member.email })],
    [t('export.capacityLabel', { value: formatTime(member.expectedCapacity) })],
    [t('export.allocatedLabel', { value: formatTime(member.currentWorkload) })],
    [t('export.utilizationLabel', { value: member.utilizationPercentage })],
    [t('export.statusLabel', { value: statusLabel })],
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
  const isGuest = useAppSelector(state => state.projectReducer.project?.is_guest === true);
  const dispatch = useAppDispatch();
  const { capacityUnit, alertThresholds, dateRange } = useAppSelector(
    state => state.projectWorkload
  );
  const { token } = theme.useToken();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  // ── FIX 1: View Details modal state ──────────────────────────────────────
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [detailsMember, setDetailsMember] = useState<IWorkloadMember | null>(null);

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
      // Prefer the real logged-time aggregate (same source the primary query path
      // uses) over the raw, un-deduplicated tasks array so Allocated/Utilization
      // stay consistent with the deduplicated task count shown below.
      const currentWorkload = member.logs_date_union?.total_time_spent_seconds
        ? Math.round((Number(member.logs_date_union.total_time_spent_seconds) / 3600) * 100) / 100
        : calculateWorkloadFromTasks(member.tasks, dateRange.startDate, dateRange.endDate) || 0;

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
        tasks: normalizeMemberTasks(member.tasks, member),
        hasAnyAssignment: member.has_any_assignment ?? true,
      };
    });
  }, [data, dateRange.startDate, dateRange.endDate]);

  // ── FIX 1: Handler — View Details ─────────────────────────────────────────
  const handleViewDetails = (record: IWorkloadMember) => {
    dispatch(setSelectedMember(record.id)); // keep Redux state in sync
    setDetailsMember(record);
    setDetailsModalVisible(true);
  };

  // ── FIX 3: Handler — Export Workload ─────────────────────────────────────
  const handleExportWorkload = (record: IWorkloadMember) => {
    exportWorkloadAsCSV(record, record.tasks || [], t);
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
        const tasksCount = record.tasks?.length || 0;
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
              { type: 'divider' },
              {
                key: 'export',
                label: t('actions.exportWorkload'),
                icon: <ExportOutlined />,
                disabled: isGuest,
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
    const memberTasks = record.tasks || [];

    const taskColumns: ColumnsType<ITaskAllocation> = [
      {
        title: t('table.taskName'),
        key: 'taskName',
        render: (_, task) => (
          <Typography.Text ellipsis style={{ maxWidth: 300 }}>
            {task.taskName || `${t('calendar.task')} ${task.taskId || t('table.unknown')}`}
          </Typography.Text>
        ),
      },
      {
        title: t('table.duration'),
        key: 'duration',
        render: (_, task) => (
          <Typography.Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {task.startDate || t('table.noStart')} -{' '}
            {task.endDate || t('table.noEnd')}
          </Typography.Text>
        ),
      },
      {
        title: t('table.estimatedHours'),
        key: 'estimatedHours',
        render: (_, task) => formatTime(task.estimatedHours || 4),
      },
      {
        title: t('table.priority'),
        key: 'priority',
        render: (_, task) => (
          <Tag color={task.priorityColor || 'default'}>
            {task.priority || t('table.defaultPriority')}
          </Tag>
        ),
      },
      {
        title: t('table.status'),
        key: 'status',
        render: (_, task) => (
          <Tag color={task.statusColor || 'default'}>
            {task.status || t('table.defaultStatus')}
          </Tag>
        ),
      },
    ];

    return (
      <Table
        columns={taskColumns}
        dataSource={memberTasks}
        rowKey={task => task.taskId}
        pagination={false}
        size="small"
        locale={{
          emptyText: (
            <EmptyListPlaceholder
              text={
                record.hasAnyAssignment === false
                  ? t('table.noTasksAssigned')
                  : t('table.noTasksAssignedForPeriod', {
                      startDate: formatDate(dateRange.startDate),
                      endDate: formatDate(dateRange.endDate),
                    })
              }
              imageHeight={80}
            />
          ),
        }}
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
      <div className="workload-table-compact" style={{ padding: 6, flex: 1, minHeight: 0 }}>
        <Table
          columns={columns}
          dataSource={workloadMembers}
          rowKey="id"
          size="small"
          expandable={{
            expandedRowKeys,
            onExpand: handleExpand,
            expandedRowRender,
            expandIcon: ({ expanded, onExpand, record }) =>
              expanded ? (
                <DownOutlined style={{ fontSize: 12, cursor: 'pointer' }} onClick={e => onExpand(record, e)} />
              ) : (
                <RightOutlined style={{ fontSize: 12, cursor: 'pointer' }} onClick={e => onExpand(record, e)} />
              ),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            size: 'small',
            showTotal: total => t('table.totalMembers', { total }),
          }}
          scroll={{ x: 1200 }}
        />
      </div>

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
    </>
  );
};

export default WorkloadTable;