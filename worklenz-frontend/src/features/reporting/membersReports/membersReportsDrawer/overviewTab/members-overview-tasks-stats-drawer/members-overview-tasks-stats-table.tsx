import {
  Badge,
  Collapse,
  Flex,
  Table,
  TableColumnsType,
  Tag,
  Typography,
} from '@/shared/antd-imports';
import CustomTableTitle from '@components/CustomTableTitle';
import { colors } from '@/styles/colors';
import dayjs from 'dayjs';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { DoubleRightOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  fetchTask,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { setProjectId } from '@/features/project/project.slice';

interface ReportingTaskRecord {
  id: string;
  project_id?: string;
  sub_tasks_count?: number | string;
  name?: string;
  status_color?: string;
  status_name?: string;
  priority_color?: string;
  priority_name?: string;
  phase_color?: string;
  phase_name?: string;
  due_date?: string | null;
  completed_date?: string | null;
  overdue_days?: number | string;
  total_time_string?: string;
  time_spent_string?: string;
  overlogged_time_string?: string;
}

type MembersOverviewTasksStatsTableProps = {
  tasksData: ReportingTaskRecord[];
  title: string;
  color: string;
  setSeletedTaskId: (id: string) => void;
};

const MembersOverviewTasksStatsTable = ({
  tasksData,
  title,
  color,
  setSeletedTaskId,
}: MembersOverviewTasksStatsTableProps) => {
  // localization
  const { t } = useTranslation('reporting-members-drawer');

  const dispatch = useAppDispatch();

  // function to handle task drawer open
  const handleUpdateTaskDrawer = (task: ReportingTaskRecord) => {
    if (!task.id || !task.project_id) return;

    setSeletedTaskId(task.id);
    dispatch(setSelectedTaskId(task.id));
    dispatch(setProjectId(task.project_id));
    dispatch(fetchPhasesByProjectId(task.project_id));
    dispatch(fetchTask({ taskId: task.id, projectId: task.project_id }));
    dispatch(setShowTaskDrawer(true));
  };

  const columns: TableColumnsType<ReportingTaskRecord> = [
    {
      key: 'task',
      title: <CustomTableTitle title={t('taskColumn')} />,
      onCell: record => {
        return {
          onClick: () => handleUpdateTaskDrawer(record),
        };
      },
      render: record => (
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
          {record.due_date ? `${dayjs(record.due_date, 'YYYY-MM-DD').format('MMM DD, YYYY')}` : '-'}
        </Typography.Text>
      ),
      width: 120,
    },
    {
      key: 'completedOn',
      title: <CustomTableTitle title={t('completedOnColumn')} />,
      render: record => (
        <Typography.Text className="text-center group-hover:text-[#1890ff]">
          {record.completed_date ? `${dayjs(record.completed_date).format('MMM DD, YYYY')}` : '-'}
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
              columns={columns}
              dataSource={tasksData}
              pagination={false}
              scroll={{ x: 'max-content' }}
              onRow={record => {
                return {
                  style: { height: 38, cursor: 'pointer' },
                  className: 'group even:bg-[#4e4e4e10]',
                };
              }}
            />
          ),
        },
      ]}
    />
  );
};

export default MembersOverviewTasksStatsTable;
