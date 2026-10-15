import { useEffect, useState, useMemo, useCallback, memo, useLayoutEffect, useRef } from 'react';
import {
  Button,
  ConfigProvider,
  Empty,
  Flex,
  Pagination,
  Table,
  TableColumnsType,
  TableProps,
  Tag,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { ExpandAltOutlined } from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import ProjectCell from '@/components/reporting/table-cells/ProjectCell';
import EstimatedVsActualCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/estimated-vs-actual-cell/estimated-vs-actual-cell';
import TasksProgressCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/tasks-progress-cell/tasks-progress-cell';
import LastActivityCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/last-activity-cell/last-activity-cell';
import ProjectStatusCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/project-status-cell/project-status-cell';
import ProjectClientCell from '@/components/reporting/table-cells/ProjectClientCell';
import ProjectTeamCell from '@/components/reporting/table-cells/ProjectTeamCell';
import ProjectManagerCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/project-manager-cell/project-manager-cell';
import TimeVarianceCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/time-variance-cell/time-variance-cell';
import ProjectDatesCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/project-dates-cell/project-dates-cell';
import ProjectHealthCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/project-health-cell/project-health-cell';
import ProjectCategoryCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/project-category-cell/project-category-cell';
import ProjectDaysLeftAndOverdueCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/project-days-left-and-overdue-cell/project-days-left-and-overdue-cell';
import ProjectUpdateCell from '@/pages/reporting/projects-reports/components/projects-reports-table/table-cells/project-update-cell/project-update-cell';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';
import { fetchProjectManagers } from '@/features/projects/projectsSlice';
import { clientsApiService } from '@/api/clients/clients.api.service';
import { IClient } from '@/types/client.types';
import {
  fetchProjectDataForCurrentView,
  setSelectedClients,
  setSelectedProjectCategories,
  setSelectedProjectHealths,
  setSelectedProjectManagers,
  setSelectedProjectPriorities,
  setSelectedProjectStatuses,
  fetchProjectData,
  resetProjectReports,
  setField,
  setIndex,
  setOrder,
  setPageSize,
  setProjectEndDate,
  setProjectHealth,
  setProjectStartDate,
  toggleProjectReportsDrawer,
} from '@/features/reporting/projectReports/project-reports-slice';
import { colors } from '@/styles/colors';
import CustomTableTitle from '@/components/CustomTableTitle';
import { IRPTProject } from '@/types/reporting/reporting.types';
import ProjectReportsDrawer from '@/features/reporting/projectReports/projectReportsDrawer/ProjectReportsDrawer';
import { PAGE_SIZE_OPTIONS } from '@/shared/constants';
import './projects-reports-table.css';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

const ProjectsReportsTable = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects');
  const { socket, connected } = useSocket();

  const [selectedProject, setSelectedProject] = useState<IRPTProject | null>(null);
  const { projectStatuses, loading: projectStatusesLoading } = useAppSelector(
    state => state.projectStatusesReducer
  );

  const {
    projectList,
    isLoading,
    total,
    index,
    pageSize,
    order,
    field,
    searchQuery,
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    selectedClients,
    selectedProjectPriorities,
    archived,
  } = useAppSelector(state => state.projectReportsReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);
  const { priorities } = useAppSelector(state => state.projectPriorityReducer);
  const { projectManagers } = useAppSelector(state => state.projectsReducer);
  const [clients, setClients] = useState<IClient[]>([]);

  // Load the lookups that back the column-header filters
  useEffect(() => {
    if (!projectHealths.length) dispatch(fetchProjectHealth());
    if (!projectCategories.length) dispatch(fetchProjectCategories());
    if (!priorities.length) dispatch(fetchProjectPriorities());
    if (!projectManagers.length) dispatch(fetchProjectManagers());
    clientsApiService
      .getClientsLookup('')
      .then(response => {
        if (response.done && Array.isArray(response.body)) setClients(response.body);
      })
      .catch(() => setClients([]));
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const columnsVisibility = useAppSelector(state => state.projectReportsTableColumnsReducer);

  const handleHealthChangeResponse = useCallback(
    (data: { id: string; health_id: string; color_code: string; name: string }) => {
      dispatch(setProjectHealth(data));
    },
    [dispatch]
  );

  const handleEndDateChangeResponse = useCallback(
    (data: { project_id: string; end_date: string }) => {
      dispatch(
        setProjectEndDate({
          id: data.project_id,
          end_date: data.end_date,
        })
      );
    },
    [dispatch]
  );

  const handleStartDateChangeResponse = useCallback(
    (data: { project_id: string; start_date: string }) => {
      dispatch(
        setProjectStartDate({
          id: data.project_id,
          start_date: data.start_date,
        })
      );
    },
    [dispatch]
  );

  useEffect(() => {
    if (!socket) return;
    socket.on(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), handleHealthChangeResponse);
    socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleEndDateChangeResponse);
    socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleStartDateChangeResponse);
    return () => {
      socket.off(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), handleHealthChangeResponse);
      socket.off(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleEndDateChangeResponse);
      socket.off(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleStartDateChangeResponse);
    };
  }, [socket, handleHealthChangeResponse, handleEndDateChangeResponse, handleStartDateChangeResponse]);

  const handleDrawerOpen = useCallback(
    (record: IRPTProject) => {
      setSelectedProject(record);
      dispatch(toggleProjectReportsDrawer());
    },
    [dispatch]
  );

  // Only the active sort field shows a sort indicator; priority (critical -> low) is the default.
  const sortOrderFor = useCallback(
    (columnField: string) =>
      field === columnField ? (order === 'asc' ? ('ascend' as const) : ('descend' as const)) : null,
    [field, order]
  );

  const columns: TableColumnsType<IRPTProject> = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: <CustomTableTitle title={t('projectColumn')} />,
        width: 300,
        sorter: true,
        sortOrder: sortOrderFor('name'),
        fixed: 'left' as const,
        onCell: record => ({
          onClick: () => handleDrawerOpen(record as IRPTProject),
        }),
        render: (_, record: { id: string; name: string; color_code: string }) => (
          <Flex gap={16} align="center" justify="space-between">
            <ProjectCell
              projectId={record.id}
              project={record.name}
              projectColor={record.color_code}
            />
            <ExpandAltOutlined
              className="hidden group-hover:flex"
              aria-label={t('openButton', { defaultValue: 'Open' })}
            />
          </Flex>
        ),
      },
      {
        key: 'estimatedVsActual',
        title: <CustomTableTitle title={t('estimatedVsActualColumn')} />,
        render: record => (
          <EstimatedVsActualCell
            actualTime={record.actual_time || 0}
            actualTimeString={record.actual_time_string}
            estimatedTime={record.estimated_time * 60 || 0}
            estimatedTimeString={record.estimated_time_string}
          />
        ),
        width: 230,
      },
      {
        key: 'timeVariance',
        title: <CustomTableTitle title={t('timeVarianceColumn', { defaultValue: 'Time Variance' })} />,
        render: (_, record: IRPTProject) => (
          <TimeVarianceCell
            actualSeconds={record.actual_time || 0}
            estimatedMinutes={record.estimated_time || 0}
          />
        ),
        width: 160,
      },
      {
        key: 'tasksProgress',
        title: <CustomTableTitle title={t('tasksProgressColumn')} />,
        render: record => <TasksProgressCell tasksStat={record.tasks_stat} />,
        width: 200,
      },
      {
        key: 'lastActivity',
        title: <CustomTableTitle title={t('lastActivityColumn')} />,
        render: record => (
          <LastActivityCell activity={record.last_activity?.last_activity_string} />
        ),
        width: 200,
      },
      {
        key: 'status',
        filters: projectStatuses.map(item => ({ text: item.name, value: item.id as string })),
        filterSearch: true,
        filteredValue: selectedProjectStatuses.length
          ? selectedProjectStatuses.map(item => item.id as string)
          : null,
        dataIndex: 'status_id',
        title: <CustomTableTitle title={t('statusColumn')} />,
        render: (_, record: IRPTProject) => (
          <ProjectStatusCell currentStatus={record.status_id} projectId={record.id} />
        ),
        width: 200,
        sorter: true,
        sortOrder: sortOrderFor('status_id'),
      },
      {
        key: 'priority',
        filters: priorities.map(item => ({ text: item.name, value: item.id as string })),
        filterSearch: true,
        filteredValue: selectedProjectPriorities.length ? selectedProjectPriorities : null,
        dataIndex: 'priority_name',
        sorter: true,
        sortOrder: sortOrderFor('priority_name'),
        title: <CustomTableTitle title={t('priorityColumn', { defaultValue: 'Priority' })} />,
        render: (_, record: IRPTProject) =>
          record.priority_name ? (
            <Tag
              color={record.priority_color || undefined}
              style={{ margin: 0 }}
            >
              {record.priority_name}
            </Tag>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              —
            </Typography.Text>
          ),
        width: 130,
      },
      {
        key: 'startDate',
        dataIndex: 'start_date',
        title: <CustomTableTitle title={t('startDateColumn', { defaultValue: 'Start Date' })} />,
        render: (_, record: IRPTProject) => (
          <ProjectDatesCell
            projectId={record.id}
            startDate={record.start_date}
            endDate={record.end_date}
            mode="start"
          />
        ),
        width: 150,
      },
      {
        key: 'endDate',
        dataIndex: 'end_date',
        title: <CustomTableTitle title={t('endDateColumn', { defaultValue: 'End Date' })} />,
        render: (_, record: IRPTProject) => (
          <ProjectDatesCell
            projectId={record.id}
            startDate={record.start_date}
            endDate={record.end_date}
            mode="end"
          />
        ),
        width: 150,
      },
      {
        key: 'daysLeft',
        dataIndex: 'days_left',
        title: <CustomTableTitle title={t('daysLeftColumn')} />,
        render: (_, record: IRPTProject) => (
          <ProjectDaysLeftAndOverdueCell
            daysLeft={record.days_left}
            isOverdue={record.is_overdue}
            isToday={record.is_today}
          />
        ),
        width: 200,
      },
      {
        key: 'projectHealth',
        filters: projectHealths.map(item => ({ text: item.name, value: item.id as string })),
        filterSearch: true,
        filteredValue: selectedProjectHealths.length
          ? selectedProjectHealths.map(item => item.id as string)
          : null,
        dataIndex: 'project_health',
        title: <CustomTableTitle title={t('projectHealthColumn')} />,
        sorter: true,
        sortOrder: sortOrderFor('project_health'),
        render: (_, record: IRPTProject) => (
          <ProjectHealthCell
            value={record.project_health}
            label={record.health_name}
            color={record.health_color}
            projectId={record.id}
          />
        ),
        width: 200,
      },
      {
        key: 'category',
        filters: projectCategories.map(item => ({ text: item.name, value: item.id as string })),
        filterSearch: true,
        filteredValue: selectedProjectCategories.length
          ? selectedProjectCategories.map(item => item.id as string)
          : null,
        title: <CustomTableTitle title={t('categoryColumn')} />,
        dataIndex: 'category_name',
        sorter: true,
        sortOrder: sortOrderFor('category_name'),
        // ← Add className on the <td> so our CSS can target it
        onCell: () => ({ className: 'category-cell' }),
        render: (_, record: IRPTProject) => (
          <ProjectCategoryCell
            projectId={record.id}
            id={record.category_id || ''}
            name={record.category_name || ''}
            color_code={record.category_color || ''}
          />
        ),
        width: 200,
      },
      {
        key: 'projectUpdate',
        title: <CustomTableTitle title={t('projectUpdateColumn')} />,
        onCell: () => ({ className: 'project-update-cell' }),
        render: (_, record: IRPTProject) =>
          record.comment ? <ProjectUpdateCell updates={record.comment} /> : '-',
        width: 200,
      },
      {
        key: 'client',
        filters: clients.map(item => ({ text: item.name, value: item.id as string })),
        filterSearch: true,
        filteredValue: selectedClients.length ? selectedClients : null,
        dataIndex: 'client',
        title: <CustomTableTitle title={t('clientColumn')} />,
        render: (_, record: IRPTProject) =>
          record?.client ? <ProjectClientCell client={record.client} /> : '-',
        sorter: true,
        sortOrder: sortOrderFor('client'),
        width: 200,
      },
      {
        key: 'team',
        dataIndex: 'team_name',
        title: <CustomTableTitle title={t('teamColumn')} />,
        render: (_, record: IRPTProject) =>
          record.team_name ? <ProjectTeamCell team={record.team_name} /> : '-',
        sorter: true,
        sortOrder: sortOrderFor('team_name'),
        width: 200,
      },
      {
        key: 'projectManager',
        filters: projectManagers.map(item => ({
          text: item.name,
          value: item.id as string,
        })),
        filterSearch: true,
        filteredValue: selectedProjectManagers.length
          ? selectedProjectManagers.map(item => item.id as string)
          : null,
        title: <CustomTableTitle title={t('projectManagerColumn')} />,
        render: (_, record: IRPTProject) =>
          record.project_manager ? <ProjectManagerCell manager={record.project_manager} /> : '-',
        width: 200,
      },
    ],
    [
      t,
      sortOrderFor,
      handleDrawerOpen,
      projectStatuses,
      priorities,
      projectHealths,
      projectCategories,
      projectManagers,
      clients,
      selectedProjectStatuses,
      selectedProjectPriorities,
      selectedProjectHealths,
      selectedProjectCategories,
      selectedClients,
      selectedProjectManagers,
    ]
  );

  // The first load has no rows yet, so draw placeholder rows instead of an empty state.
  const showSkeleton = isLoading && projectList.length === 0;

  const skeletonData = useMemo(
    () => buildSkeletonRows<IRPTProject>(pageSize),
    [pageSize]
  );

  const visibleColumns = useMemo(() => {
    const visible = columns.filter(col => columnsVisibility[col.key as string]);
    if (!showSkeleton) return visible;
    return toSkeletonColumns(visible);
  }, [columns, columnsVisibility, showSkeleton]);

  const handleTableChange = useCallback(
    (
      _pagination: unknown,
      filters: Record<string, (string | number | boolean | bigint)[] | null>,
      sorter: { order?: string; field?: string }
    ) => {
      if (sorter.order && sorter.field) {
        dispatch(setOrder(sorter.order));
        dispatch(setField(sorter.field));
      } else {
        // Sort cleared: fall back to the default (priority, critical -> low)
        dispatch(setOrder('desc'));
        dispatch(setField('priority_name'));
      }

      const ids = (key: string) => (filters[key] ?? []).map(String);
      const statusIds = ids('status');
      const healthIds = ids('projectHealth');
      const categoryIds = ids('category');
      const managerIds = ids('projectManager');

      dispatch(
        setSelectedProjectStatuses(projectStatuses.filter(i => statusIds.includes(i.id as string)))
      );
      dispatch(
        setSelectedProjectHealths(projectHealths.filter(i => healthIds.includes(i.id as string)))
      );
      dispatch(setSelectedProjectPriorities(ids('priority')));
      dispatch(setSelectedClients(ids('client')));

      // Category and manager reducers toggle one item at a time, so toggle only the differences.
      const toggleDiff = <T extends { id?: string }>(
        all: T[],
        current: T[],
        nextIds: string[],
        toggle: (item: T) => void
      ) => {
        const currentIds = current.map(i => i.id as string);
        all
          .filter(i => currentIds.includes(i.id as string) !== nextIds.includes(i.id as string))
          .forEach(toggle);
      };
      toggleDiff(projectCategories, selectedProjectCategories, categoryIds, item =>
        dispatch(setSelectedProjectCategories(item))
      );
      toggleDiff(projectManagers, selectedProjectManagers, managerIds, item =>
        dispatch(setSelectedProjectManagers(item))
      );

      dispatch(setIndex(1));
      dispatch(fetchProjectDataForCurrentView());
    },
    [
      dispatch,
      projectStatuses,
      projectHealths,
      projectCategories,
      projectManagers,
      selectedProjectCategories,
      selectedProjectManagers,
    ]
  );

  useEffect(() => {
    if (!isLoading) dispatch(fetchProjectData());
    if (projectStatuses.length === 0 && !projectStatusesLoading) dispatch(fetchProjectStatuses());
  }, [
    dispatch,
    searchQuery,
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    archived,
    index,
    pageSize,
    order,
    field,
  ]);

  useEffect(() => {
    return () => {
      dispatch(resetProjectReports());
    };
  }, [dispatch]);

  const tableRowProps = useMemo(
    () => ({
      style: { height: 56, cursor: 'pointer' },
      className: 'group',
    }),
    []
  );

  const tableConfig = useMemo(
    () => ({
      theme: {
        components: {
          Table: {
            cellPaddingBlock: 12,
            cellPaddingInline: 10,
          },
        },
      },
    }),
    []
  );

  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  // Size the table body to the space left above the pagination footer so the header stays visible.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
      setScrollY(Math.max(120, element.clientHeight - header - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [projectList, isLoading]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      dispatch(setIndex(nextPage));
    },
    [dispatch]
  );
  const handlePageSizeChange = useCallback(
    (nextSize: number) => {
      dispatch(setPageSize(nextSize));
      dispatch(setIndex(1));
    },
    [dispatch]
  );

  const rangeStart = total === 0 ? 0 : (index - 1) * pageSize + 1;
  const rangeEnd = Math.min(index * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const scrollConfig = useMemo(() => ({ x: 'max-content', y: scrollY }), [scrollY]);
  const getRowKey = useCallback((record: IRPTProject) => record.id, []);
  const getRowProps = useCallback(
    () => (showSkeleton ? { style: { height: 56 } } : tableRowProps),
    [showSkeleton, tableRowProps]
  );

  return (
    <ConfigProvider {...tableConfig}>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
        style={{ borderColor: token.colorBorderSecondary, background: token.colorBgContainer }}
      >
        <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
          <Table
            className="projects-reports-table"
            showSorterTooltip={false}
            columns={visibleColumns}
            dataSource={showSkeleton ? skeletonData : projectList}
            pagination={false}
            scroll={scrollConfig}
            loading={isLoading && !showSkeleton}
            onChange={handleTableChange as unknown as TableProps<IRPTProject>['onChange']}
            rowKey={getRowKey}
            onRow={getRowProps}
            locale={{
              emptyText: (
                <Empty description={t('emptyTitle', { defaultValue: 'No projects to show' })} />
              ),
            }}
          />
        </div>
        <Flex
          align="center"
          justify="space-between"
          gap={12}
          wrap="wrap"
          className="px-4 py-3"
          style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
        >
          <Flex align="center" gap={8}>
            <label htmlFor="projects-reports-page-size" className="text-xs">
              {t('rowsPerPage', { defaultValue: 'Rows per page:' })}
            </label>
            <select
              id="projects-reports-page-size"
              value={pageSize}
              onChange={event => handlePageSizeChange(Number(event.target.value))}
              className="rounded-md border px-2 py-1 text-xs"
              style={{
                background: token.colorBgContainer,
                color: token.colorText,
                borderColor: token.colorBorder,
              }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-xs" style={{ color: token.colorTextSecondary }}>
              {t('rangeOfTotal', {
                start: rangeStart,
                end: rangeEnd,
                total,
                defaultValue: '{{start}}-{{end}} of {{total}}',
              })}
            </span>
          </Flex>
          <Flex align="center" gap={8}>
            <Button
              size="small"
              aria-label={t('firstPage', { defaultValue: 'First page' })}
              disabled={index <= 1}
              onClick={() => handlePageChange(1)}
            >
              «
            </Button>
            <Pagination
              current={index}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              onChange={handlePageChange}
            />
            <Button
              size="small"
              aria-label={t('lastPage', { defaultValue: 'Last page' })}
              disabled={index >= lastPage}
              onClick={() => handlePageChange(lastPage)}
            >
              »
            </Button>
          </Flex>
        </Flex>
      </div>
      {createPortal(<ProjectReportsDrawer selectedProject={selectedProject} />, document.body)}
    </ConfigProvider>
  );
};

export default memo(ProjectsReportsTable);