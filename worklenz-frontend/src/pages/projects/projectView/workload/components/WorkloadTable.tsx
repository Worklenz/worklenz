import { useState, useMemo } from 'react';
import { Table, Avatar, Progress, Tag, Button, Flex, Tooltip, Typography, Space, Dropdown, Modal, theme } from '@/shared/antd-imports';
import { MoreOutlined, SwapOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { IWorkloadData, IWorkloadMember, ITaskAllocation } from '@/types/workload/workload.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';

import { setSelectedMember } from '@/features/project-workload/projectWorkloadSlice';
import { ColumnsType } from 'antd/es/table';

interface WorkloadTableProps {
  data: IWorkloadData;
}

const WorkloadTable = ({ data }: WorkloadTableProps) => {
  const { t } = useTranslation('workload');
  const dispatch = useAppDispatch();
  const { capacityUnit, alertThresholds } = useAppSelector(state => state.projectWorkload);
  const { token } = theme.useToken();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ITaskAllocation | null>(null);

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
            <Typography.Text type="secondary" style={{ fontSize: 12, color: token.colorTextSecondary }}>
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
        const workingDays = record.dailyCapacity > 0 ? Math.round(record.weeklyCapacity / record.dailyCapacity) : 5;
        return (
          <Tooltip 
            title={t('calculations.capacityTooltip', {
              weeklyCapacity: capacity,
              dailyHours: record.dailyCapacity,
              workingDays: workingDays
            })}
            placement="top"
          >
            <Typography.Text>
              {capacity} {capacityUnit === 'hours' ? t('overview.hours') : t('overview.points')}
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
            {workload} {capacityUnit === 'hours' ? t('overview.hours') : t('overview.points')}
          </Typography.Text>
          {record.isOverallocated && (
            <Tag color="red" style={{ fontSize: 10, backgroundColor: token.colorErrorBg, borderColor: token.colorError }}>
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
          utilization > alertThresholds.overallocation ? 'exception' :
          utilization < alertThresholds.underutilization ? 'normal' :
          'success';

        const workingDays = record.dailyCapacity > 0 ? Math.round(record.weeklyCapacity / record.dailyCapacity) : 5;
        
        return (
          <Tooltip 
            title={t('calculations.utilizationTooltip', {
              utilization: utilization,
              assignedHours: record.currentWorkload,
              weeklyCapacity: record.weeklyCapacity,
              dailyHours: record.dailyCapacity,
              workingDays: workingDays
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
            return t('calculations.statusTooltip.underutilized', { threshold: alertThresholds.underutilization });
          }
          return t('calculations.statusTooltip.optimal', { threshold: alertThresholds.underutilization });
        };
        
        if (record.isOverallocated) {
          return (
            <Tooltip title={getStatusTooltip()} placement="top">
              <Tag style={{ backgroundColor: token.colorErrorBg, borderColor: token.colorError, color: token.colorError }}>
                {t('status.overallocated')}
              </Tag>
            </Tooltip>
          );
        }
        if (record.isUnderutilized) {
          return (
            <Tooltip title={getStatusTooltip()} placement="top">
              <Tag style={{ backgroundColor: token.colorWarningBg, borderColor: token.colorWarning, color: token.colorWarning }}>
                {t('status.underutilized')}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={getStatusTooltip()} placement="top">
            <Tag style={{ backgroundColor: token.colorSuccessBg, borderColor: token.colorSuccess, color: token.colorSuccess }}>
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
        const tasks = data.allocations.filter(a => a.memberId === record.id);
        return (
          <Typography.Text>
            {tasks.length} {t('table.tasks')}
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
                disabled: data.allocations.filter(a => a.memberId === record.id).length === 0,
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
    const memberTasks = data.allocations.filter(a => a.memberId === record.id);

    const taskColumns: ColumnsType<ITaskAllocation> = [
      {
        title: t('table.taskName'),
        dataIndex: 'taskName',
        key: 'taskName',
        render: (name) => (
          <Typography.Text ellipsis style={{ maxWidth: 300 }}>
            {name}
          </Typography.Text>
        ),
      },
      {
        title: t('table.project'),
        dataIndex: 'projectName',
        key: 'projectName',
      },
      {
        title: t('table.duration'),
        key: 'duration',
        render: (_, task) => (
          <Typography.Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {task.startDate} - {task.endDate}
          </Typography.Text>
        ),
      },
      {
        title: t('table.estimatedHours'),
        dataIndex: 'estimatedHours',
        key: 'estimatedHours',
        render: (hours) => `${hours}h`,
      },
      {
        title: t('table.priority'),
        dataIndex: 'priority',
        key: 'priority',
        render: (priority, task) => (
          <Tag color={task.priorityColor || 'default'}>
            {priority}
          </Tag>
        ),
      },
      {
        title: t('table.status'),
        dataIndex: 'status',
        key: 'status',
        render: (status, task) => (
          <Tag color={task.statusColor || 'default'}>
            {status}
          </Tag>
        ),
      },
      {
        title: t('table.progress'),
        dataIndex: 'completionPercentage',
        key: 'progress',
        render: (progress) => (
          <Progress percent={progress} size="small" style={{ width: 60 }} />
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
              setSelectedTask(task);
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
        rowKey="id"
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
        dataSource={data.members}
        rowKey="id"
        expandable={{
          expandedRowKeys,
          onExpand: handleExpand,
          expandedRowRender,
        }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => t('table.totalMembers', { total }),
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