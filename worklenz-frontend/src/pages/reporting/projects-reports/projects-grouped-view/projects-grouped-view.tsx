import { memo, useMemo, useEffect, useState, useCallback } from 'react';
import { Collapse, Progress, Typography, Flex, Badge, Empty, Spin, Button, Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IRPTProject } from '@/types/reporting/reporting.types';
import { 
  fetchProjectData, 
  fetchMoreProjectsForGroupedView, 
  setIndex, 
  setPageSize 
} from '@/features/reporting/projectReports/project-reports-slice';
import ProjectTasksModal from './project-tasks-modal';
import './projects-grouped-view.css';

// For grouped view, use larger page size for better grouping
const GROUPED_VIEW_PAGE_SIZE = 100;

// Pagination constants
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

interface IProgressSegments {
  todo: number;
  doing: number;
  done: number;
  total: number;
  percentDone: number;
}

const getProgressSegments = (todo: number, doing: number, done: number): IProgressSegments => {
  const total = todo + doing + done;
  const safeTotal = total > 0 ? total : 1;

  return {
    todo,
    doing,
    done,
    total,
    percentDone: Math.round((done / safeTotal) * 100),
  };
};

const ProjectsGroupedView = () => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const [selectedProject, setSelectedProject] = useState<IRPTProject | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Track visible items per group for client-side pagination
  const [groupPagination, setGroupPagination] = useState<Record<string, number>>({});

  const {
    projectList,
    groupBy,
    isLoading,
    isLoadingMore,
    total,
    index,
    pageSize,
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

  // Fetch project data when filters change
  useEffect(() => {
    dispatch(setIndex(1));
    dispatch(setPageSize(GROUPED_VIEW_PAGE_SIZE));
    dispatch(fetchProjectData());
    // Reset group pagination when filters change
    setGroupPagination({});
  }, [
    dispatch,
    searchQuery,
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    archived,
  ]);

  // Handle loading more projects (pagination at bottom of grouped view)
  const handleLoadMoreProjects = useCallback(() => {
    dispatch(setIndex(index + 1));
    dispatch(fetchMoreProjectsForGroupedView());
  }, [dispatch, index]);

  // Check if there are more projects to load
  const hasMoreProjects = projectList.length < total;

  const groupedProjects = useMemo(() => {
    const groups: Map<string, IProjectGroup> = new Map();

    projectList.forEach(project => {
      let groupKey: string;
      let groupName: string;
      let groupColor: string;

      switch (groupBy) {
        case 'category':
          groupKey = project.category_id || 'uncategorized';
          groupName = project.category_name || t('uncategorizedText');
          groupColor = project.category_color || '#a9a9a9';
          break;
        case 'status':
          groupKey = project.status_id || 'no-status';
          groupName = project.status_name || t('noStatusText');
          groupColor = project.status_color || '#a9a9a9';
          break;
        case 'health':
          groupKey = project.project_health || 'not-set';
          groupName = project.health_name || t('notSetText');
          groupColor = project.health_color || '#a9a9a9';
          break;
        case 'team':
          groupKey = project.team_id || 'no-team';
          groupName = project.team_name || t('noTeamText');
          groupColor = project.team_color || '#a9a9a9';
          break;
        case 'manager':
          groupKey = project.project_manager?.id || 'no-manager';
          groupName = project.project_manager?.name || t('noManagerText');
          groupColor = '#1890ff';
          break;
        default:
          groupKey = 'default';
          groupName = t('allProjectsText');
          groupColor = '#a9a9a9';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          name: groupName,
          color: groupColor,
          projects: [],
          totalTasks: 0,
          completedTasks: 0,
          todoTasks: 0,
          doingTasks: 0,
          doneTasks: 0,
          progressPercent: 0,
        });
      }

      const group = groups.get(groupKey)!;
      group.projects.push(project);
      // Calculate total tasks from todo + doing + done (same as TasksProgressCell)
      const projectTodoTasks = project.tasks_stat?.todo || 0;
      const projectDoingTasks = project.tasks_stat?.doing || 0;
      const projectDoneTasks = project.tasks_stat?.done || 0;
      const projectTotalTasks = projectTodoTasks + projectDoingTasks + projectDoneTasks;
      group.totalTasks += projectTotalTasks;
      group.completedTasks += projectDoneTasks;
      group.todoTasks += projectTodoTasks;
      group.doingTasks += projectDoingTasks;
      group.doneTasks += projectDoneTasks;
    });

    groups.forEach(group => {
      group.progressPercent =
        group.totalTasks > 0
          ? Math.round((group.completedTasks / group.totalTasks) * 100)
          : 0;
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [projectList, groupBy, t]);

  const renderProjectItem = useCallback(
    (project: IRPTProject) => {
      // Calculate total tasks from todo + doing + done (same as TasksProgressCell)
      const todoTasks = project.tasks_stat?.todo || 0;
      const doingTasks = project.tasks_stat?.doing || 0;
      const doneTasks = project.tasks_stat?.done || 0;
      const { total, percentDone } = getProgressSegments(todoTasks, doingTasks, doneTasks);

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
      groupedProjects.map(group => {
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
    [groupedProjects, t, getVisibleCount, handleLoadMore, renderProjectItem]
  );

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ padding: 48 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (groupedProjects.length === 0) {
    return <Empty description={t('noProjectsText')} />;
  }

  return (
    <div className="projects-grouped-view">
      <Collapse
        items={collapseItems}
        defaultActiveKey={groupedProjects.slice(0, 3).map(g => g.id)}
        expandIconPosition="start"
      />
      
      {/* Load More Projects Button */}
      {hasMoreProjects && (
        <Flex justify="center" style={{ padding: '24px 0', marginTop: '16px' }}>
          <Button
            type="default"
            size="large"
            onClick={handleLoadMoreProjects}
            loading={isLoadingMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore 
              ? t('loadingText') 
              : t('loadMoreProjectsButton', { 
                  remaining: total - projectList.length 
                })
            }
          </Button>
        </Flex>
      )}
      
      {/* Show total loaded vs total available */}
      {!isLoading && projectList.length > 0 && (
        <Flex justify="center" style={{ padding: '8px 0', color: '#999' }}>
          <Typography.Text type="secondary">
            {t('showingProjectsText', { 
              shown: projectList.length, 
              total: total 
            })}
          </Typography.Text>
        </Flex>
      )}

      <ProjectTasksModal
        open={isModalOpen}
        project={selectedProject}
        onClose={handleModalClose}
      />
    </div>
  );
};

export default memo(ProjectsGroupedView);
