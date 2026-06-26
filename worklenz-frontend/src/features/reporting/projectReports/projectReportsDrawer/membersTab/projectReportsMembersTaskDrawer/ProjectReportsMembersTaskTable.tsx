import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Badge,
  ConfigProvider,
  Flex,
  Table,
  TableColumnsType,
  Tag,
  Typography,
} from '@/shared/antd-imports';
import dayjs from 'dayjs';
import { DoubleRightOutlined } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import CustomTableTitle from '@components/CustomTableTitle';
import { colors } from '@/styles/colors';
import { lazy } from 'react';
import {
  fetchTask,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { setProjectId } from '@/features/project/project.slice';

const TaskDrawer = lazy(() => import('@components/task-drawer/task-drawer'));

type ProjectReportsMembersTasksTableProps = {
  tasksData: any[];
  loading?: boolean;
};

interface ReportingTaskRecord {
  id: string;
  project_id: string;
}

const ProjectReportsMembersTasksTable = ({
  tasksData,
  loading = false,
}: ProjectReportsMembersTasksTableProps) => {
  // localization
  const { t } = useTranslation('reporting-projects-drawer');

  const dispatch = useAppDispatch();

  // function to handle task drawer open
  const handleUpdateTaskDrawer = useCallback(
    (id: string, projectId: string) => {
      if (!id || !projectId) return;

      dispatch(setSelectedTaskId(id));
      dispatch(setProjectId(projectId));
      dispatch(fetchPhasesByProjectId(projectId));
      dispatch(fetchTask({ taskId: id, projectId }));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch]
  );

  const columns: TableColumnsType = [
    {
      key: 'task',
      title: <CustomTableTitle title={t('taskColumn')} />,
      render: record => (
        <Flex>
          {Number(record.sub_tasks_count) > 0 && <DoubleRightOutlined />}
          <Typography.Text className="group-hover:text-[#1890ff]">{record.name}</Typography.Text>
        </Flex>
      ),
      width: 260,
      fixed: 'left' as const,
    },
    {
      key: 'project',
      title: <CustomTableTitle title={t('projectColumn')} />,
      render: record => (
        <Flex gap={8} align="center">
          <Badge color={record.project_color} />
          <Typography.Text>{record.project_name}</Typography.Text>
        </Flex>
      ),
      width: 120,
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
      key: 'completedDate',
      title: <CustomTableTitle title={t('completedDateColumn')} />,
      render: record => (
        <Typography.Text className="text-center group-hover:text-[#1890ff]">
          {record.completed_at ? `${dayjs(record.completed_at).format('MMM DD, YYYY')}` : '-'}
        </Typography.Text>
      ),
      width: 120,
    },
    {
      key: 'estimatedTime',
      title: <CustomTableTitle title={t('estimatedTimeColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      render: record => record.estimated_string || '-',
      width: 130,
    },
    {
      key: 'loggedTime',
      title: <CustomTableTitle title={t('loggedTimeColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      render: record => record.time_spent_string || '-',
      width: 130,
    },
    {
      key: 'overloggedTime',
      title: <CustomTableTitle title={t('overloggedTimeColumn')} />,
      className: 'text-center group-hover:text-[#1890ff]',
      render: record => record.overlogged_time || '-',
      width: 150,
    },
  ];

  // Memoize table configuration
  const tableConfig = useMemo(
    () => ({
      theme: {
        components: {
          Table: {
            cellPaddingBlock: 8,
            cellPaddingInline: 10,
          },
        },
      },
    }),
    []
  );

  // Memoize row props generator
  const getRowProps = useMemo(
    () => (record: ReportingTaskRecord) => ({
      onClick: () => handleUpdateTaskDrawer(record.id, record.project_id),
      style: { height: 38, cursor: 'pointer' },
      className: 'group even:bg-[#4e4e4e10]',
    }),
    [handleUpdateTaskDrawer]
  );

  return (
    <>
      <ConfigProvider {...tableConfig}>
        <Table
          columns={columns}
          dataSource={tasksData}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowKey={record => record.id}
          onRow={getRowProps}
        />
      </ConfigProvider>
      {createPortal(<TaskDrawer />, document.body, 'task-drawer')}
    </>
  );
};

export default ProjectReportsMembersTasksTable;
