import { memo, useMemo, useEffect, useState, useCallback, useLayoutEffect, useRef } from 'react';
import {
  Badge,
  Button,
  ConfigProvider,
  Empty,
  Flex,
  Progress,
  Table,
  TableColumnsType,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { ExpandAltOutlined, RightOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IRPTProject } from '@/types/reporting/reporting.types';
import { fetchGroupedProjects } from '@/features/reporting/projectReports/project-reports-slice';
import CustomTableTitle from '@/components/CustomTableTitle';
import ProjectTasksModal from './project-tasks-modal';
import './projects-grouped-view.css';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';

const PROJECTS_PER_PAGE = 20;

// Shared widths so the expanded project rows line up with the group columns above them.
const GROUP_COLUMN_WIDTH = 260;
const PROJECTS_COLUMN_WIDTH = 110;
const TOTAL_TASKS_COLUMN_WIDTH = 120;

interface IProjectGroup {
  id: string;
  name: string;
  color: string;
  projects: IRPTProject[];
  projectCount: number;
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
}

const getProgressColor = (percent: number, successColor: string, primaryColor: string) =>
  percent === 100 ? successColor : primaryColor;

const ProjectsGroupedView = () => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const [selectedProject, setSelectedProject] = useState<IRPTProject | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  /**
   * Translates group names from backend translation keys to localized strings.
   * Maps backend keys like "no_manager" to frontend translation keys like "noManagerText".
   * Falls back to original name if not a translation key (e.g., actual team/manager names).
   */
  const translateGroupName = useCallback(
    (name: string): string => {
      const translationKeyMap: Record<string, string> = {
        no_manager: 'noManagerText',
        no_client: 'noClientText',
        no_team: 'noTeamText',
        no_status: 'noStatusText',
        not_set: 'notSetText',
        uncategorized: 'uncategorizedText',
      };

      const translationKey = translationKeyMap[name];
      return translationKey ? t(translationKey) : name;
    },
    [t]
  );

  const {
    groupedProjects,
    groupBy,
    isLoading,
    loadingTeams,
    searchQuery,
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    archived,
  } = useAppSelector(state => state.projectReportsReducer);

  const handleProjectClick = useCallback((project: IRPTProject) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Fetch grouped project data when filters change (including search)
  useEffect(() => {
    dispatch(fetchGroupedProjects());
    setExpandedKeys([]);
  }, [
    dispatch,
    groupBy,
    searchQuery,
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    archived,
  ]);

  const groups: IProjectGroup[] = useMemo(
    () =>
      groupedProjects.map(group => ({
        id: group.group_id,
        name: translateGroupName(group.group_name),
        color: group.group_color,
        projects: group.projects,
        projectCount: group.project_count,
        totalTasks: group.total_tasks,
        doneTasks: group.done_tasks,
        progressPercent:
          group.total_tasks > 0 ? Math.round((group.done_tasks / group.total_tasks) * 100) : 0,
      })),
    [groupedProjects, translateGroupName]
  );

  const getProjectStats = (project: IRPTProject) => {
    const todo = project.tasks_stat?.todo || 0;
    const doing = project.tasks_stat?.doing || 0;
    const done = project.tasks_stat?.done || 0;
    const total = project.tasks_stat?.total || todo + doing + done;
    return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  // Progress / percent / x-of-y columns are identical for groups and projects
  const progressColumns = <T extends object>(
    getStats: (record: T) => { done: number; total: number; percent: number }
  ): TableColumnsType<T> => [
    {
      key: 'progress',
      title: <CustomTableTitle title={t('progressColumn', { defaultValue: 'Progress' })} />,
      width: 180,
      render: (_, record) => {
        const { percent } = getStats(record);
        return (
          <Progress
            percent={percent}
            showInfo={false}
            size="small"
            strokeColor={getProgressColor(percent, token.colorSuccess, token.colorPrimary)}
          />
        );
      },
    },
    {
      key: 'percent',
      title: <CustomTableTitle title={t('percentColumn', { defaultValue: 'Percent' })} />,
      width: 100,
      align: 'center',
      render: (_, record) => `${getStats(record).percent}%`,
    },
    {
      key: 'tasks',
      title: (
          <CustomTableTitle title={t('tasksCountColumn', { defaultValue: 'Tasks (done/total)' })} />
        ),
      width: 160,
      align: 'center',
      render: (_, record) => {
        const { done, total } = getStats(record);
        return `${done}/${total} ${t('tasksText')}`;
      },
    },
  ];

  const projectColumns: TableColumnsType<IRPTProject> = useMemo(
    () => [
      {
        key: 'name',
        title: <CustomTableTitle title={t('projectColumn')} />,
        dataIndex: 'name',
        // Spans the group name and Projects columns so the columns after it line up with the parent.
        width: GROUP_COLUMN_WIDTH + PROJECTS_COLUMN_WIDTH,
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (_, project) => (
          <Flex align="center" justify="space-between" gap={16}>
            <Flex align="center" gap={8} style={{ minWidth: 0 }}>
              <Badge color={project.color_code} />
              <Typography.Text ellipsis={{ tooltip: project.name }}>{project.name}</Typography.Text>
            </Flex>
            <ExpandAltOutlined
              className="hidden group-hover:flex"
              aria-label={t('openButton', { defaultValue: 'Open' })}
            />
          </Flex>
        ),
      },
      {
        key: 'totalTasks',
        title: <CustomTableTitle title={t('totalTasksColumn', { defaultValue: 'Total Tasks' })} />,
        width: TOTAL_TASKS_COLUMN_WIDTH,
        align: 'center',
        sorter: (a, b) => getProjectStats(a).total - getProjectStats(b).total,
        render: (_, project) => getProjectStats(project).total,
      },
      ...progressColumns<IRPTProject>(getProjectStats),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, handleProjectClick, token]
  );

  const columns: TableColumnsType<IProjectGroup> = useMemo(
    () => [
      {
        key: 'group',
        title: <CustomTableTitle title={translateGroupHeader(groupBy, t)} />,
        fixed: 'left',
        width: GROUP_COLUMN_WIDTH,
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (_, group) => {
          const isExpanded = expandedKeys.includes(group.id);
          return (
            <Flex gap={4} align="center">
              {group.projects.length > 0 ? (
                <Button
                  type="text"
                  size="small"
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded
                      ? t('collapseRow', { name: group.name, defaultValue: 'Collapse {{name}}' })
                      : t('expandRow', { name: group.name, defaultValue: 'Expand {{name}}' })
                  }
                  icon={
                    <RightOutlined
                      style={{
                        fontSize: 10,
                        transition: 'transform 200ms',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                      }}
                    />
                  }
                  onClick={() =>
                    setExpandedKeys(keys =>
                      isExpanded ? keys.filter(key => key !== group.id) : [...keys, group.id]
                    )
                  }
                />
              ) : (
                <span className="inline-block w-6" aria-hidden />
              )}
              <Badge color={group.color} />
              <Typography.Text strong>{group.name}</Typography.Text>
            </Flex>
          );
        },
      },
      {
        key: 'projectCount',
        title: <CustomTableTitle title={t('projectsCountColumn', { defaultValue: 'Projects' })} />,
        width: PROJECTS_COLUMN_WIDTH,
        align: 'center',
        sorter: (a, b) => a.projectCount - b.projectCount,
        render: (_, group) => group.projectCount,
      },
      {
        key: 'totalTasks',
        title: <CustomTableTitle title={t('totalTasksColumn', { defaultValue: 'Total Tasks' })} />,
        width: TOTAL_TASKS_COLUMN_WIDTH,
        align: 'center',
        sorter: (a, b) => a.totalTasks - b.totalTasks,
        render: (_, group) => group.totalTasks,
      },
      ...progressColumns<IProjectGroup>(group => ({
        done: group.doneTasks,
        total: group.totalTasks,
        percent: group.progressPercent,
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, groupBy, expandedKeys, token]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  // Size the table body to the available space so the header stays visible (same as the table view).
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
  }, [groupedProjects, isLoading]);

  const tableTheme = useMemo(
    () => ({
      components: {
        Table: {
          cellPaddingBlock: 12,
          cellPaddingInline: 10,
        },
      },
    }),
    []
  );

  // Show spinner while loading OR if teams haven't loaded yet (needed for filter validation)
  const showSkeleton = (isLoading || loadingTeams) && groups.length === 0;
  const showEmptyState = !isLoading && !loadingTeams && groupedProjects.length === 0;

  return (
    <ConfigProvider theme={tableTheme}>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
        style={{ borderColor: token.colorBorderSecondary, background: token.colorBgContainer }}
      >
        <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
          <Table<IProjectGroup>
            tableLayout="fixed"
            showSorterTooltip={false}
            loading={(isLoading || loadingTeams) && !showSkeleton}
            pagination={false}
            rowKey="id"
            columns={showSkeleton ? toSkeletonColumns(columns) : columns}
            dataSource={showSkeleton ? buildSkeletonRows<IProjectGroup>(10) : groups}
            scroll={{ x: 'max-content', y: scrollY }}
            onRow={() => ({ style: { height: 56 } })}
            locale={{ emptyText: <Empty description={t('noProjectsText')} /> }}
            expandable={{
              showExpandColumn: false,
              expandedRowKeys: expandedKeys,
              rowExpandable: group => (group.projects?.length ?? 0) > 0,
              expandedRowRender: group => (
                <Table<IRPTProject>
                  className="grouped-child-table"
                  tableLayout="fixed"
                  showSorterTooltip={false}
                  rowKey="id"
                  columns={projectColumns}
                  dataSource={group.projects}
                  pagination={
                    group.projects.length > PROJECTS_PER_PAGE
                      ? { pageSize: PROJECTS_PER_PAGE, showSizeChanger: false }
                      : false
                  }
                  onRow={project => ({
                    className: 'group',
                    style: { height: 56, cursor: 'pointer' },
                    onClick: () => handleProjectClick(project),
                  })}
                />
              ),
            }}
          />
        </div>

        {!showEmptyState && (
          <ProjectTasksModal
            open={isModalOpen}
            project={selectedProject}
            onClose={handleModalClose}
          />
        )}
      </div>
    </ConfigProvider>
  );
};

// Header of the first column follows the active grouping
const translateGroupHeader = (
  groupBy: string,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const labels: Record<string, [string, string]> = {
    category: ['groupByCategoryText', 'Category'],
    status: ['groupByStatusText', 'Status'],
    health: ['groupByHealthText', 'Health'],
    team: ['groupByTeamText', 'Team'],
    client: ['groupByClientText', 'Client'],
    manager: ['groupByManagerText', 'Project Manager'],
  };
  const [key, fallback] = labels[groupBy] ?? labels.category;
  return t(key, { defaultValue: fallback });
};

export default memo(ProjectsGroupedView);
