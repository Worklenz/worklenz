import { ExpandAltOutlined, SyncOutlined } from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Flex,
  Segmented,
  Select,
  Skeleton,
  Table,
  TableProps,
  Tooltip,
  Typography,
  Pagination,
} from 'antd';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import ListView from './list-view';
import CalendarView from './calendar-view';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import EmptyListPlaceholder from '@components/EmptyListPlaceholder';
import { colors } from '@/styles/colors';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import { IMyTask } from '@/types/home/my-tasks.types';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { useGetMyTasksQuery } from '@/api/home-page/home-page.api.service';
import { IHomeTasksModel } from '@/types/home/home-page.types';
import './tasks-list.css';
import HomeTasksStatusDropdown from '@/components/home-tasks/statusDropdown/home-tasks-status-dropdown';
import HomeTasksDatePicker from '@/components/home-tasks/taskDatePicker/home-tasks-date-picker';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { setProjectId } from '@/features/project/project.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';

const TasksList: React.FC = React.memo(() => {
  const dispatch = useAppDispatch();

  const [viewOptions, setViewOptions] = useState<'List' | 'Calendar'>('List');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [skipAutoRefetch, setSkipAutoRefetch] = useState<boolean>(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const {
    data,
    isFetching: homeTasksFetching,
    refetch: originalRefetch,
    isLoading,
  } = useGetMyTasksQuery(homeTasksConfig, {
    skip: skipAutoRefetch,
    refetchOnMountOrArgChange: false,
    refetchOnReconnect: false,
    refetchOnFocus: false,
  });

  const { t } = useTranslation('home');
  const { model } = useAppSelector(state => state.homePageReducer);

  const taskModes = useMemo(
    () => [
      {
        value: 0,
        label: t('home:tasks.assignedToMe'),
      },
      {
        value: 1,
        label: t('home:tasks.assignedByMe'),
      },
    ],
    [t]
  );

  const handleSegmentChange = (value: 'List' | 'Calendar') => {
    setSkipAutoRefetch(false);
    setViewOptions(value);
    dispatch(setHomeTasksConfig({ ...homeTasksConfig, is_calendar_view: value === 'Calendar' }));
    setCurrentPage(1);
  };

  useEffect(() => {
    dispatch(fetchLabels());
    dispatch(fetchPriorities());
    dispatch(
      getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true })
    );
  }, [dispatch]);

  const handleSelectTask = useCallback(
    (task: IMyTask) => {
      dispatch(setSelectedTaskId(task.id || ''));
      dispatch(fetchTask({ taskId: task.id || '', projectId: task.project_id || '' }));
      dispatch(setProjectId(task.project_id || ''));
      dispatch(setShowTaskDrawer(true));
      dispatch(setHomeTasksConfig({ ...homeTasksConfig, selected_task_id: task.id || '' }));
    },
    [dispatch, setSelectedTaskId, setShowTaskDrawer, fetchTask, homeTasksConfig]
  );

  const refetch = useCallback(() => {
    setSkipAutoRefetch(false);
    originalRefetch();
  }, [originalRefetch]);

  const handlePageChange = (page: number) => {
    setSkipAutoRefetch(true);
    setCurrentPage(page);
  };

  const columns: TableProps<IMyTask>['columns'] = useMemo(
    () => [
      {
        key: 'name',
        title: (
          <Flex justify="space-between" align="center" style={{ width: '100%' }}>
            <span>{t('tasks.name')}</span>
          </Flex>
        ),
        width: '40%',
        render: (_, record) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tooltip title={record.name}>
              <Typography.Text style={{ flex: 1, marginRight: 8 }}>
                {record.name}
              </Typography.Text>
            </Tooltip>
            <div className="row-action-button">
              <Tooltip title={'Click open task form'}>
                <Button
                  type="text"
                  icon={<ExpandAltOutlined />}
                  onClick={() => {
                    handleSelectTask(record);
                  }}
                  style={{
                    backgroundColor: colors.transparent,
                    padding: 0,
                    height: 'fit-content',
                  }}
                >
                  Open
                </Button>
              </Tooltip>
            </div>
          </div>
        ),
      },
      {
        key: 'project',
        title: t('tasks.project'),
        width: '25%',
        render: (_, record) => {
          return (
            <Tooltip title={record.project_name}>
              <Typography.Paragraph
                style={{ margin: 0, paddingInlineEnd: 6 }}
              >
                <Badge color={record.project_color || 'blue'} style={{ marginInlineEnd: 4 }} />
                {record.project_name}
              </Typography.Paragraph>
            </Tooltip>
          );
        },
      },
      {
        key: 'status',
        title: t('tasks.status'),
        width: '20%',
        render: (_, record) => (
          <HomeTasksStatusDropdown task={record} teamId={record.team_id || ''} />
        ),
      },
      {
        key: 'dueDate',
        title: t('tasks.dueDate'),
        width: '15%',
        dataIndex: 'end_date',
        render: (_, record) => <HomeTasksDatePicker record={record} />,
      },
    ],
    [t, data?.body?.total, currentPage, pageSize, handlePageChange]
  );

  const handleTaskModeChange = (value: number) => {
    setSkipAutoRefetch(false);
    dispatch(setHomeTasksConfig({ ...homeTasksConfig, tasks_group_by: value }));
    setCurrentPage(1);
  };

  // Add effect to handle task config changes
  useEffect(() => {
    // Only refetch if we're not skipping auto refetch
    if (!skipAutoRefetch) {
      originalRefetch();
    }
  }, [homeTasksConfig, skipAutoRefetch, originalRefetch]);

  useEffect(() => {
    dispatch(fetchLabels());
    dispatch(fetchPriorities());
    dispatch(
      getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true })
    );
  }, [dispatch]);

  return (
    <Card
      title={
        <Flex gap={8} align="center">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('tasks.tasks')}
          </Typography.Title>
          <Select
            defaultValue={taskModes[0].label}
            options={taskModes}
            onChange={value => handleTaskModeChange(+value)}
            fieldNames={{ label: 'label', value: 'value' }}
          />
        </Flex>
      }
      extra={
        <Flex gap={8} align="center">
          <Tooltip title={t('tasks.refresh')} trigger={'hover'}>
            <Button
              shape="circle"
              icon={<SyncOutlined spin={homeTasksFetching} />}
              onClick={refetch}
            />
          </Tooltip>
          <Segmented<'List' | 'Calendar'>
            options={[
              { value: 'List', label: t('tasks.list') },
              { value: 'Calendar', label: t('tasks.calendar') },
            ]}
            defaultValue="List"
            onChange={handleSegmentChange}
          />
        </Flex>
      }
      style={{
        width: '100%',
        border: '1px solid transparent',
        boxShadow:
          themeMode === 'dark'
            ? 'rgba(0, 0, 0, 0.4) 0px 4px 12px, rgba(255, 255, 255, 0.06) 0px 2px 4px'
            : '#7a7a7a26 0 5px 16px',
      }}
    >
      {/* toggle task view list / calendar */}
      {viewOptions === 'List' ? (
        <ListView refetch={refetch} model={data?.body || (model as IHomeTasksModel)} />
      ) : (
        <CalendarView />
      )}

      {/* task list table --> render with different filters and views  */}
      {!data?.body || isLoading ? (
        <Skeleton active />
      ) : data?.body.total === 0 ? (
        <EmptyListPlaceholder
          imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
          text=" No tasks to show."
        />
      ) : (
        <>
          <Table
            className="custom-two-colors-row-table"
            dataSource={
              data?.body.tasks
                ? data.body.tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)
                : []
            }
            rowKey={record => record.id || ''}
            columns={columns as TableProps<IMyTask>['columns']}
            size="middle"
            rowClassName={() => 'custom-row-height'}
            loading={homeTasksFetching && skipAutoRefetch}
            pagination={false}
          />

          <div
            style={{
              marginTop: 16,
              textAlign: 'right',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={data?.body.total || 0}
              onChange={handlePageChange}
              showSizeChanger={false}
            />
          </div>
        </>
      )}
    </Card>
  );
});

export default TasksList;
