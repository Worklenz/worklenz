import { memo, useMemo, useEffect, useState, useCallback } from 'react';
import { Collapse, Progress, Typography, Flex, Badge, Empty, Spin, Button, Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IRPTProject } from '@/types/reporting/reporting.types';
import { 
  fetchGroupedProjects
} from '@/features/reporting/projectReports/project-reports-slice';
import ProjectTasksModal from './project-tasks-modal';
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

  // Track visible items per group for client-side pagination
  const [groupPagination, setGroupPagination] = useState<Record<string, number>>({});

  const {
    groupedProjects,
    groupBy,
    isLoading,
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
  const getVisibleCount = useCallback((groupId: string) => {
    return groupPagination[groupId] || INITIAL_ITEMS_PER_GROUP;
  }, [groupPagination]);

  // Fetch grouped project data when filters or grouping changes
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
      name: group.group_name,
      color: group.group_color,
      projects: group.projects,
      totalTasks: group.total_tasks,
      completedTasks: group.done_tasks,
      todoTasks: group.todo_tasks,
      doingTasks: group.doing_tasks,
      doneTasks: group.done_tasks,
      progressPercent: group.total_tasks > 0
        ? Math.round((group.done_tasks / group.total_tasks) * 100)
        : 0,
    }));
  }, [groupedProjects]);

  const renderProjectItem = useCallback(
    (project: IRPTProject) => {
      // Use raw task counts from backend (not percentages)
      const todoTasks = project.tasks_stat?.todo || 0;
      const doingTasks = project.tasks_stat?.doing || 0;
      const doneTasks = project.tasks_stat?.done || 0;
      const total = project.tasks_stat?.total || (todoTasks + doingTasks + doneTasks);
      const percentDone = total > 0 ? Math.round((doneTasks / total) * 100) : 0;

      const progressTooltipTitle = (
        <Flex vertical>
          <Typography.Text>
            {t('todoText')}: {todoTasks}
          </Typography.Text>
          <Typography.Text>
            {t('doingText')}: {doingTasks}
          </Typography.Text>
          <Typography.Text>
            {t('doneText')}: {doneTasks}
          </Typography.Text>
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
    [handleProjectClick, t]
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
                    <Flex vertical>
                      <Typography.Text>
                        {t('todoText')}: {group.todoTasks}
                      </Typography.Text>
                      <Typography.Text>
                        {t('doingText')}: {group.doingTasks}
                      </Typography.Text>
                      <Typography.Text>
                        {t('doneText')}: {group.doneTasks}
                      </Typography.Text>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadMore(group.id);
                    }}
                    className="show-more-button"
                  >
                    {t('showMoreButton', {
                      count: Math.min(remainingCount, ITEMS_PER_PAGE)
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

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ padding: 48 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (transformedGroups.length === 0) {
    return <Empty description={t('noProjectsText')} />;
  }

  return (
    <div className="projects-grouped-view">
      <Collapse
        items={collapseItems}
        defaultActiveKey={transformedGroups.slice(0, 3).map(g => g.id)}
        expandIconPosition="start"
      />

      <ProjectTasksModal
        open={isModalOpen}
        project={selectedProject}
        onClose={handleModalClose}
      />
    </div>
  );
};

export default memo(ProjectsGroupedView);
