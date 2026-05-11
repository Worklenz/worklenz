import { memo, useMemo, useEffect, useState, useCallback } from 'react';
import {
  Collapse,
  Progress,
  Typography,
  Flex,
  Badge,
  Empty,
  Spin,
  Button,
  Tooltip,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IRPTProject } from '@/types/reporting/reporting.types';
import { fetchGroupedProjects } from '@/features/reporting/projectReports/project-reports-slice';
import ProjectTasksModal from './project-tasks-modal';
import { colors } from '@/styles/colors';
import './projects-grouped-view.css';

// Pagination constants for expanding projects within groups (client-side)
const INITIAL_ITEMS_PER_GROUP = 20; // Initial display per group
const ITEMS_PER_PAGE = 20; // Items to load on "Show More"

interface IProjectGroup {
  id: string;
  name: string;
  color: string;
  projects: IRPTProject[];
  totalTasks: number;
  completedTasks: number;
  todoTasks: number;
  doingTasks: number;
  doneTasks: number;
  progressPercent: number;
}

const ProjectsGroupedView = () => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const [selectedProject, setSelectedProject] = useState<IRPTProject | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Track visible items per group for client-side pagination
  const [groupPagination, setGroupPagination] = useState<Record<string, number>>({});

  /**
   * Translates group names from backend translation keys to localized strings.
   * Maps backend keys like "no_manager" to frontend translation keys like "noManagerText".
   * Falls back to original name if not a translation key (e.g., actual team/manager names).
   */
  const translateGroupName = useCallback(
    (name: string): string => {
      const translationKeyMap: Record<string, string> = {
        no_manager: 'noManagerText',
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

  // Handle project click to open modal
  const handleProjectClick = useCallback((project: IRPTProject) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Handle showing more projects within a group (client-side expansion)
  const handleLoadMore = useCallback((groupId: string) => {
    setGroupPagination(prev => ({
      ...prev,
      [groupId]: (prev[groupId] || INITIAL_ITEMS_PER_GROUP) + ITEMS_PER_PAGE,
    }));
  }, []);

  // Get visible count for a group
  const getVisibleCount = useCallback(
    (groupId: string) => {
      return groupPagination[groupId] || INITIAL_ITEMS_PER_GROUP;
    },
    [groupPagination]
  );

  // Fetch grouped project data when filters change (including search)
  useEffect(() => {
    dispatch(fetchGroupedProjects());
    // Reset group pagination when filters change
    setGroupPagination({});
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

  // Transform backend grouped data to component format
  const transformedGroups = useMemo(() => {
    return groupedProjects.map(group => ({
      id: group.group_id,
      name: translateGroupName(group.group_name), // Translate backend keys to localized strings
      color: group.group_color,
      projects: group.projects,
      totalTasks: group.total_tasks,
      completedTasks: group.done_tasks,
      todoTasks: group.todo_tasks,
      doingTasks: group.doing_tasks,
      doneTasks: group.done_tasks,
      progressPercent:
        group.total_tasks > 0 ? Math.round((group.done_tasks / group.total_tasks) * 100) : 0,
    }));
  }, [groupedProjects, translateGroupName]);

  const renderProjectItem = useCallback(
    (project: IRPTProject) => {
      // Use raw task counts from backend (not percentages)
      const todoTasks = project.tasks_stat?.todo || 0;
      const doingTasks = project.tasks_stat?.doing || 0;
      const doneTasks = project.tasks_stat?.done || 0;
      const total = project.tasks_stat?.total || todoTasks + doingTasks + doneTasks;
      const percentDone = total > 0 ? Math.round((doneTasks / total) * 100) : 0;

      // Enhanced tooltip with improved UI design
      // Ant Design Tooltip has dark background in both themes, so white text works
      const tooltipTextColor = colors.white;
      const dividerColor = 'rgba(255, 255, 255, 0.2)';

      const progressTooltipTitle = (
        <Flex vertical gap={10} style={{ minWidth: 220, padding: '2px 0' }}>
          {/* Top section: Total tasks with emphasis */}
          <Flex vertical gap={2}>
            <Typography.Text
              strong
              style={{
                color: tooltipTextColor,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {doneTasks}/{total} {t('tasksText')}
            </Typography.Text>
          </Flex>

          {/* Divider */}
          <div
            style={{
              height: 1,
              backgroundColor: dividerColor,
              width: '100%',
              margin: '2px 0',
            }}
          />

          {/* Middle section: Task status breakdown with better spacing */}
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="center">
              <Typography.Text style={{ color: tooltipTextColor, fontSize: 12, opacity: 0.9 }}>
                {t('todoText')}:
              </Typography.Text>
              <Typography.Text
                strong
                style={{ color: tooltipTextColor, fontSize: 12, fontWeight: 500 }}
              >
                {todoTasks}
              </Typography.Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Typography.Text style={{ color: tooltipTextColor, fontSize: 12, opacity: 0.9 }}>
                {t('doingText')}:
              </Typography.Text>
              <Typography.Text
                strong
                style={{ color: tooltipTextColor, fontSize: 12, fontWeight: 500 }}
              >
                {doingTasks}
              </Typography.Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Typography.Text style={{ color: tooltipTextColor, fontSize: 12, opacity: 0.9 }}>
                {t('doneText')}:
              </Typography.Text>
              <Typography.Text
                strong
                style={{ color: tooltipTextColor, fontSize: 12, fontWeight: 500 }}
              >
                {doneTasks}
              </Typography.Text>
            </Flex>
          </Flex>

          {/* Divider */}
          <div
            style={{
              height: 1,
              backgroundColor: dividerColor,
              width: '100%',
              margin: '2px 0',
            }}
          />

          {/* Bottom section: Progress bar with percentage - improved layout */}
          <Flex vertical gap={6}>
            <Flex align="center" gap={10} style={{ width: '100%' }}>
              <Progress
                percent={percentDone}
                size="small"
                style={{ flex: 1, minWidth: 120 }}
                strokeColor={percentDone === 100 ? '#52c41a' : '#1890ff'}
                showInfo={false}
                strokeWidth={6}
              />
              <Typography.Text
                strong
                style={{
                  color: tooltipTextColor,
                  fontSize: 13,
                  fontWeight: 600,
                  minWidth: 40,
                  textAlign: 'right',
                }}
              >
                {percentDone}%
              </Typography.Text>
            </Flex>
          </Flex>
        </Flex>
      );

      return (
        <div
          key={project.id}
          className="grouped-project-item"
          onClick={() => handleProjectClick(project)}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleProjectClick(project);
            }
          }}
        >
          <Flex justify="space-between" align="center" gap={16}>
            <Flex align="center" gap={8} style={{ flex: 1, minWidth: 0 }}>
              <Badge color={project.color_code} />
              <Typography.Text ellipsis style={{ flex: 1 }} className="project-name-text">
                {project.name}
              </Typography.Text>
            </Flex>
            <Flex align="center" gap={16} style={{ flexShrink: 0 }}>
              <Tooltip title={progressTooltipTitle}>
                <Progress
                  percent={percentDone}
                  size="small"
                  style={{ width: 100 }}
                  strokeColor={percentDone === 100 ? '#52c41a' : '#1890ff'}
                />
              </Tooltip>
              <Typography.Text type="secondary" style={{ minWidth: 70, textAlign: 'right' }}>
                {doneTasks}/{total} {t('tasksText')}
              </Typography.Text>
            </Flex>
          </Flex>
        </div>
      );
    },
    [handleProjectClick, t, themeMode]
  );

  const collapseItems = useMemo(
    () =>
      transformedGroups.map(group => {
        const visibleCount = getVisibleCount(group.id);
        const visibleProjects = group.projects.slice(0, visibleCount);
        const hasMore = visibleCount < group.projects.length;
        const remainingCount = group.projects.length - visibleCount;

        return {
          key: group.id,
          label: (
            <Flex justify="space-between" align="center" style={{ width: '100%' }}>
              <Flex align="center" gap={8}>
                <Badge color={group.color} />
                <Typography.Text strong>
                  {group.name} ({group.projects.length}{' '}
                  {group.projects.length === 1 ? t('projectText') : t('projectsText')})
                </Typography.Text>
              </Flex>
              <Flex align="center" gap={16}>
                <Typography.Text type="secondary">
                  {group.completedTasks}/{group.totalTasks} {t('tasksText')}
                </Typography.Text>
                <Tooltip
                  title={
                    <Flex vertical gap={10} style={{ minWidth: 220, padding: '2px 0' }}>
                      {/* Top section: Total tasks with emphasis */}
                      <Flex vertical gap={2}>
                        <Typography.Text
                          strong
                          style={{
                            color: colors.white,
                            fontSize: 14,
                            fontWeight: 600,
                            lineHeight: 1.4,
                          }}
                        >
                          {group.doneTasks}/{group.totalTasks} {t('tasksText')}
                        </Typography.Text>
                      </Flex>

                      {/* Divider */}
                      <div
                        style={{
                          height: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          width: '100%',
                          margin: '2px 0',
                        }}
                      />

                      {/* Middle section: Task status breakdown with better spacing */}
                      <Flex vertical gap={6}>
                        <Flex justify="space-between" align="center">
                          <Typography.Text
                            style={{ color: colors.white, fontSize: 12, opacity: 0.9 }}
                          >
                            {t('todoText')}:
                          </Typography.Text>
                          <Typography.Text
                            strong
                            style={{ color: colors.white, fontSize: 12, fontWeight: 500 }}
                          >
                            {group.todoTasks}
                          </Typography.Text>
                        </Flex>
                        <Flex justify="space-between" align="center">
                          <Typography.Text
                            style={{ color: colors.white, fontSize: 12, opacity: 0.9 }}
                          >
                            {t('doingText')}:
                          </Typography.Text>
                          <Typography.Text
                            strong
                            style={{ color: colors.white, fontSize: 12, fontWeight: 500 }}
                          >
                            {group.doingTasks}
                          </Typography.Text>
                        </Flex>
                        <Flex justify="space-between" align="center">
                          <Typography.Text
                            style={{ color: colors.white, fontSize: 12, opacity: 0.9 }}
                          >
                            {t('doneText')}:
                          </Typography.Text>
                          <Typography.Text
                            strong
                            style={{ color: colors.white, fontSize: 12, fontWeight: 500 }}
                          >
                            {group.doneTasks}
                          </Typography.Text>
                        </Flex>
                      </Flex>

                      {/* Divider */}
                      <div
                        style={{
                          height: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          width: '100%',
                          margin: '2px 0',
                        }}
                      />

                      {/* Bottom section: Progress bar with percentage - improved layout */}
                      <Flex vertical gap={6}>
                        <Flex align="center" gap={10} style={{ width: '100%' }}>
                          <Progress
                            percent={group.progressPercent}
                            size="small"
                            style={{ flex: 1, minWidth: 120 }}
                            strokeColor={group.progressPercent === 100 ? '#52c41a' : '#1890ff'}
                            showInfo={false}
                            strokeWidth={6}
                          />
                          <Typography.Text
                            strong
                            style={{
                              color: colors.white,
                              fontSize: 13,
                              fontWeight: 600,
                              minWidth: 40,
                              textAlign: 'right',
                            }}
                          >
                            {group.progressPercent}%
                          </Typography.Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  }
                >
                  <Progress
                    percent={group.progressPercent}
                    size="small"
                    style={{ width: 80 }}
                    strokeColor={group.progressPercent === 100 ? '#52c41a' : '#1890ff'}
                  />
                </Tooltip>
              </Flex>
            </Flex>
          ),
          children: (
            <div className="grouped-projects-list">
              {visibleProjects.map(renderProjectItem)}
              {hasMore && (
                <Flex justify="center" style={{ padding: '16px 0' }}>
                  <Button
                    type="link"
                    onClick={e => {
                      e.stopPropagation();
                      handleLoadMore(group.id);
                    }}
                    className="show-more-button"
                  >
                    {t('showMoreButton', {
                      count: Math.min(remainingCount, ITEMS_PER_PAGE),
                    })}
                  </Button>
                </Flex>
              )}
            </div>
          ),
        };
      }),
    [transformedGroups, t, getVisibleCount, handleLoadMore, renderProjectItem]
  );

  // Show spinner while loading OR if teams haven't loaded yet (needed for filter validation)
  // Only show empty state if we're completely done loading and have no data
  const showEmptyState = !isLoading && !loadingTeams && groupedProjects.length === 0;
  const showLoadingSpinner = isLoading || loadingTeams;

  if (showEmptyState) {
    return <Empty description={t('noProjectsText')} />;
  }

  if (showLoadingSpinner) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: 200 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <div className="projects-grouped-view">
      <Collapse
        items={collapseItems}
        defaultActiveKey={transformedGroups.slice(0, 3).map(g => g.id)}
        expandIconPosition="start"
      />

      <ProjectTasksModal open={isModalOpen} project={selectedProject} onClose={handleModalClose} />
    </div>
  );
};

export default memo(ProjectsGroupedView);
