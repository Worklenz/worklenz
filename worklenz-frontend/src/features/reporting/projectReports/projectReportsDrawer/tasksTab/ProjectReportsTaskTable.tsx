import {
  Badge,
  Collapse,
  Flex,
  Table,
  TableColumnsType,
  Tag,
  Typography,
} from '@/shared/antd-imports';
import { useEffect } from 'react';
import CustomTableTitle from '@/components/CustomTableTitle';
import { colors } from '@/styles/colors';
import dayjs from 'dayjs';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { DoubleRightOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { openReportingTaskDrawer, ReportingTaskRow } from '@/utils/reporting/openReportingTaskDrawer';

type ProjectReportsTasksTableProps = {
  tasksData: Array<Record<string, unknown>>;
  title: string;
  color: string;
  type: string;
  projectId: string;
};

const ProjectReportsTasksTable = ({
  tasksData,
  title,
  color,
  type,
  projectId,
}: ProjectReportsTasksTableProps) => {
  // localization
  const { t } = useTranslation('reporting-projects-drawer');

  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchPriorities());
    dispatch(fetchLabels());
    dispatch(
      getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true })
    );
  }, [dispatch]);

  const handleOpenTaskDrawer = (task: ReportingTaskRow) => {
    openReportingTaskDrawer(dispatch, task, projectId);
  };

  const columns: TableColumnsType = [
    {
      key: 'task',
      dataIndex: 'name',
      title: <CustomTableTitle title={t('taskColumn')} />,
      onCell: record => ({
        onClick: () => handleOpenTaskDrawer(record),
      }),
      render: (_, record) => (
        <Flex>
          {Number(record.sub_tasks_count) > 0 && <DoubleRightOutlined />}
          <Typography.Text className="group-hover:text-[#1890ff]">{record.name}</Typography.Text>
        </Flex>
      ),
      width: 260,
      className: 'group-hover:text-[#1890ff]',
      fixed: 'left' as const,
    },
    {
      key: 'status',
      title: <CustomTableTitle title={t('statusColumn')} />,
      render: record => (
        <Tag
          style={{ color: colors.darkGray, borderRadius: 48 }}
          color={record.status_color}
          children={record.status_name}
        />
      ),
      width: 120,
    },
    {
      key: 'priority',
      title: <CustomTableTitle title={t('priorityColumn')} />,
      render: record => (
        <Tag
          style={{ color: colors.darkGray, borderRadius: 48 }}
          color={record.priority_color}
          children={record.priority_name}
        />
      ),
      width: 120,
    },
    {
      key: 'phase',
      title: <CustomTableTitle title={t('phaseColumn')} />,
      render: record => (
        <Tag
          style={{ color: colors.darkGray, borderRadius: 48 }}
          color={record.phase_color}
          children={record.phase_name}
        />
      ),
      width: 120,
    },
    {
      key: 'dueDate',
      title: <CustomTableTitle title={t('dueDateColumn')} />,
      render: record => (
        <Typography.Text className="text-center group-hover:text-[#1890ff]">
          {record.end_date ? `${dayjs(record.end_date, 'YYYY-MM-DD').format('MMM DD, YYYY')}` : '-'}
        </Typography.Text>
      ),
      width: 120,
    },
    {
      key: 'completedOn',
      title: <CustomTableTitle title={t('completedOnColumn')} />,
      render: record => (
        <Typography.Text className="text-center group-hover:text-[#1890ff]">
          {record.completed_at ? `${dayjs(record.completed_at).format('MMM DD, YYYY')}` : '-'}
        </Typography.Text>
      ),
      width: 120,
    },
    {
      key: 'daysOverdue',
      title: <CustomTableTitle title={t('daysOverdueColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'overdue_days',
      width: 120,
    },
    {
      key: 'estimatedTime',
      title: <CustomTableTitle title={t('estimatedTimeColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'total_time_string',
      width: 130,
    },
    {
      key: 'loggedTime',
      title: <CustomTableTitle title={t('loggedTimeColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'time_spent_string',
      width: 130,
    },
    {
      key: 'overloggedTime',
      title: <CustomTableTitle title={t('overloggedTimeColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      dataIndex: 'overlogged_time_string',
      width: 150,
    },
  ];

  // conditionaly show columns with the group type
  const visibleColumns = () => {
    if (type === 'status') return columns.filter(el => el.key !== 'status');
    else if (type === 'priority') return columns.filter(el => el.key !== 'priority');
    else if (type === 'phase') return columns.filter(el => el.key !== 'phase');
    else return columns;
  };

  return (
    <Collapse
      bordered={false}
      ghost={true}
      size="small"
      items={[
        {
          key: '1',
          label: (
            <Flex gap={8} align="center">
              <Badge color={color} />
              <Typography.Text strong>{`${title} (${tasksData.length})`}</Typography.Text>
            </Flex>
          ),
          children: (
            <Table
              rowKey="id"
              columns={visibleColumns()}
              dataSource={tasksData}
              pagination={false}
              scroll={{ x: 'max-content' }}
              onRow={record => ({
                style: { height: 38, cursor: 'pointer' },
                className: 'group even:bg-[#4e4e4e10]',
                onClick: () => handleOpenTaskDrawer(record),
              })}
            />
          ),
        },
      ]}
    />
  );
};

export default ProjectReportsTasksTable;
