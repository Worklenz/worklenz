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
import { MoreOutlined, SwapOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { IWorkloadData, IWorkloadMember, ITaskAllocation } from '@/types/workload/workload.types';
import { useAppSelector } from '@/hooks/useAppSelector';
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

// Helper function to calculate workload from tasks
const calculateWorkloadFromTasks = (tasks: any[]): number => {
  if (!Array.isArray(tasks)) return 0;
  
  let totalHours = 0;
  const now = new Date();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const startOfPeriod = new Date(currentYear, currentMonth, 1);
  const endOfPeriod = new Date(currentYear, currentMonth + 2, 0);
  
  tasks.forEach(task => {
    if (task?.start_date && task?.end_date) {
      const startDate = new Date(task.start_date);
      const endDate = new Date(task.end_date);
      
      if (startDate <= endOfPeriod && endDate >= startOfPeriod) {
        const overlapStart = new Date(Math.max(startDate.getTime(), startOfPeriod.getTime()));
        const overlapEnd = new Date(Math.min(endDate.getTime(), endOfPeriod.getTime()));
        const overlapDays = Math.max(1, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
        
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

interface WorkloadTableProps {
  data: IWorkloadData | any; // Allow raw API responses
}

const WorkloadTable = ({ data }: WorkloadTableProps) => {
  const { t } = useTranslation('workload');
  const dispatch = useAppDispatch();
  const { capacityUnit, alertThresholds } = useAppSelector(state => state.projectWorkload);
  const { token } = theme.useToken();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ITaskAllocation | null>(null);

  // Transform raw API response to expected format
  const workloadMembers = useMemo(() => {
    if (data?.members && Array.isArray(data.members)) {
      // Data is already in the expected format
      return data.members;
    }
    
    const members = data?.body || [];
    if (!Array.isArray(members)) {
      return [];
    }
    
    return members.map((member: any) => {
      const dailyHours = member.org_working_hours || 8;
      const workingDaysPerWeek = calculateWorkingDaysFromOrgSettings(member.org_working_days) || 5;
      const weeklyCapacity = dailyHours * workingDaysPerWeek;
      
      const currentWorkload = calculateWorkloadFromTasks(member.tasks) || 0;
      const utilizationPercentage = weeklyCapacity > 0 ? Math.round((currentWorkload / weeklyCapacity) * 100) : 0;
      
      return {
        id: member.project_member_id || member.team_member_id || member.user_id,
        name: member.name || 'Unknown',
        email: member.email || '',
        avatar: member.avatar_url,
        role: member.role,
        teamId: member.team_member_id,
        dailyCapacity: dailyHours,
        weeklyCapacity: weeklyCapacity,
        currentWorkload: currentWorkload,
        utilizationPercentage: utilizationPercentage,
        isOverallocated: utilizationPercentage > 100,
        isUnderutilized: utilizationPercentage < 50,
      };
    });
  }, [data]);

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
      dataIndex: 'weeklyCapacity',
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
              workingDays: workingDays,
            })}
            placement="top"
          >
            <Typography.Text>
              {capacity} {t('overview.hours')}
            </Typography.Text>
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
          <Typography.Text>
            {workload} {t('overview.hours')}
          </Typography.Text>
          {record.isOverallocated && (
            <Tag
              color="red"
              style={{
                fontSize: 10,
                backgroundColor: token.colorErrorBg,
                borderColor: token.colorError,
              }}
            >
              +{workload - record.weeklyCapacity}
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
              utilization: utilization,
              assignedHours: record.currentWorkload,
              weeklyCapacity: record.weeklyCapacity,
              dailyHours: record.dailyCapacity,
              workingDays: workingDays,
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
          if (record.isOverallocated) {
            return t('calculations.statusTooltip.overallocated');
          }
          if (record.isUnderutilized) {
            return t('calculations.statusTooltip.underutilized', {
              threshold: alertThresholds.underutilization,
            });
          }
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
        const memberData = data?.body?.find((m: any) => 
          (m.project_member_id || m.team_member_id || m.user_id) === record.id
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
                onClick: () => dispatch(setSelectedMember(record.id)),
              },
              {
                key: 'adjust',
                label: t('actions.adjustCapacity'),
                icon: <EditOutlined />,
              },
              {
                key: 'reassign',
                label: t('actions.reassignTasks'),
                icon: <SwapOutlined />,
                disabled: (() => {
                  const memberData = data?.body?.find((m: any) => 
                    (m.project_member_id || m.team_member_id || m.user_id) === record.id
                  );
                  return !memberData?.tasks?.length;
                })(),
              },
              {
                type: 'divider',
              },
              {
                key: 'export',
                label: t('actions.exportWorkload'),
                icon: <ExportOutlined />,
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
    const memberData = data?.body?.find((m: any) => 
      (m.project_member_id || m.team_member_id || m.user_id) === record.id
    );
    const memberTasks = memberData?.tasks || [];

    const taskColumns: ColumnsType<any> = [
      {
        title: t('table.taskName'),
        key: 'taskName',
        render: (_, task) => (
          <Typography.Text ellipsis style={{ maxWidth: 300 }}>
            {task.name || `Task ${task.id || 'Unknown'}`}
          </Typography.Text>
        ),
      },
      {
        title: t('table.project'),
        key: 'projectName',
        render: (_, task) => (
          <Typography.Text>
            {task.project_name || 'Current Project'}
          </Typography.Text>
        ),
      },
      {
        title: t('table.duration'),
        key: 'duration',
        render: (_, task) => (
          <Typography.Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {task.start_date ? task.start_date.split('T')[0] : 'No start'} - {task.end_date ? task.end_date.split('T')[0] : 'No end'}
          </Typography.Text>
        ),
      },
      {
        title: t('table.estimatedHours'),
        key: 'estimatedHours',
        render: (_, task) => {
          const hours = task.total_minutes ? Math.round(task.total_minutes / 60) : 4;
          return `${hours}h`;
        },
      },
      {
        title: t('table.priority'),
        key: 'priority',
        render: (_, task) => (
          <Tag color={task.priority_color || 'default'}>
            {task.priority_value || 'Medium'}
          </Tag>
        ),
      },
      {
        title: t('table.status'),
        key: 'status',
        render: (_, task) => (
          <Tag color={task.status_color || 'default'}>
            {task.status_name || 'To Do'}
          </Tag>
        ),
      },
      {
        title: t('table.progress'),
        key: 'progress',
        render: (_, task) => (
          <Progress 
            percent={task.complete_ratio || 0} 
            size="small" 
            style={{ width: 60 }} 
          />
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
                taskName: task.name || `Task ${task.id}`,
                projectId: task.project_id,
                projectName: task.project_name || 'Current Project',
                memberId: record.id,
                memberName: record.name,
                estimatedHours: task.total_minutes ? Math.round(task.total_minutes / 60) : 4,
                actualHours: 0,
                startDate: task.start_date ? task.start_date.split('T')[0] : '',
                endDate: task.end_date ? task.end_date.split('T')[0] : '',
                priority: task.priority_value || 'Medium',
                priorityColor: task.priority_color || 'default',
                status: task.status_name || 'To Do',
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
        rowKey={(task) => task.id || `task-${Math.random()}`}
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
