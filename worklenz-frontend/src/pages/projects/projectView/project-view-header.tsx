import {
  Button,
  Dropdown,
  Flex,
  Tag,
  Tooltip,
  Typography,
  ArrowLeftOutlined,
  BellFilled,
  BellOutlined,
  CalendarOutlined,
  DownOutlined,
  EditOutlined,
  ImportOutlined,
  SaveOutlined,
  SettingOutlined,
  SyncOutlined,
  UsergroupAddOutlined,
} from '@/shared/antd-imports';
// Removed PageHeader from @ant-design/pro-components due to findDOMNode deprecation warning
// Using custom header implementation instead
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { colors } from '@/styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import {
  setProject,
  setImportTaskTemplateDrawerOpen,
  setRefreshTimestamp,
  getProject,
} from '@features/project/project.slice';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import {
  addTask,
  fetchTaskGroups,
  fetchTaskListColumns,
  IGroupBy,
} from '@features/tasks/tasks.slice';
import ProjectStatusIcon from '@/components/common/project-status-icon/project-status-icon';
import { formatDate } from '@/utils/timeUtils';
import { toggleSaveAsTemplateDrawer } from '@/features/projects/projectsSlice';
import SaveProjectAsTemplate from '@/components/save-project-as-template/save-project-as-template';
import {
  fetchProjectData,
  toggleProjectDrawer,
  setProjectId,
} from '@/features/project/project-drawer.slice';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';
import { DEFAULT_TASK_NAME, UNMAPPED } from '@/shared/constants';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { getGroupIdByGroupedColumn } from '@/services/task-list/taskList.service';
import logger from '@/utils/errorLogger';
import ImportTaskTemplate from '@/components/task-templates/import-task-template';
import { ProjectDrawer } from '@/components/projects/project-drawer/project-drawer';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { addTaskCardToTheTop, fetchBoardTaskGroups } from '@/features/board/board-slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { isFreeUser } from '@/utils/subscription-utils';
import { ProjectIntegrationsButton } from '@/components/projects/integrations/ProjectIntegrationsButton';

const ProjectViewHeader = memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation('project-view/project-view-header');
  const dispatch = useAppDispatch();
  const { tab } = useTabSearchParam();

  // Memoize auth service calls to prevent unnecessary re-evaluations
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const isOwnerOrAdmin = useMemo(() => authService.isOwnerOrAdmin(), [authService]);
  const isProjectManager = useIsProjectManager();

  const { socket } = useSocket();

  // Optimized selectors with shallow equality checks
  const selectedProject = useAppSelector(state => state.projectReducer.project);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const loadingGroups = useAppSelector(state => state.taskReducer.loadingGroups);
  const groupBy = useAppSelector(state => state.taskReducer.groupBy);

  const [creatingTask, setCreatingTask] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  // State for back button hover effect
  const [isBackButtonHovered, setIsBackButtonHovered] = useState(false);

  // Use ref to track subscription timeout
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized refresh handler with optimized dependencies
  const handleRefresh = useCallback(async () => {
    if (!projectId) return;

    try {
      setRefreshLoading(true);

      // Always refresh project data
      const projectPromise = dispatch(getProject(projectId)).unwrap();

      switch (tab) {
        case 'tasks-list':
          // Dispatch all tasks-list related operations in parallel
          await Promise.allSettled([
            projectPromise,
            dispatch(fetchStatuses(projectId)).unwrap(),
            dispatch(fetchTaskListColumns(projectId)).unwrap(),
            dispatch(fetchPhasesByProjectId(projectId)).unwrap(),
            dispatch(fetchTasksV3(projectId)).unwrap()
          ]);
          break;
        case 'board':
          // Dispatch board operations
          await Promise.allSettled([
            projectPromise,
            dispatch(fetchEnhancedKanbanGroups(projectId)).unwrap()
          ]);
          break;
        case 'workload':
        case 'roadmap':
        case 'finance':
        case 'project-insights-member-overview':
        case 'all-attachments':
        case 'members':
        case 'updates':
          // Wait for project data and trigger timestamp refresh
          await projectPromise;
          dispatch(setRefreshTimestamp());
          break;
      }
    } catch (error) {
      logger.error('Error refreshing project data:', error);
    } finally {
      setRefreshLoading(false);
    }
  }, [dispatch, projectId, tab]);

  // Optimized subscription handler with proper cleanup
  const handleSubscribe = useCallback(() => {
    if (!selectedProject?.id || !socket || subscriptionLoading) return;

    try {
      setSubscriptionLoading(true);
      const newSubscriptionState = !selectedProject.subscribed;

      // Clear any existing timeout
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
      }

      // Emit socket event
      socket.emit(SocketEvents.PROJECT_SUBSCRIBERS_CHANGE.toString(), {
        project_id: selectedProject.id,
        user_id: currentSession?.id,
        team_member_id: currentSession?.team_member_id,
        mode: newSubscriptionState ? 0 : 1,
      });

      // Listen for response with cleanup
      const handleResponse = (response: any) => {
        try {
          dispatch(
            setProject({
              ...selectedProject,
              subscribed: newSubscriptionState,
            })
          );
        } catch (error) {
          logger.error('Error handling project subscription response:', error);
          dispatch(
            setProject({
              ...selectedProject,
              subscribed: selectedProject.subscribed,
            })
          );
        } finally {
          setSubscriptionLoading(false);
          if (subscriptionTimeoutRef.current) {
            clearTimeout(subscriptionTimeoutRef.current);
            subscriptionTimeoutRef.current = null;
          }
        }
      };

      socket.once(SocketEvents.PROJECT_SUBSCRIBERS_CHANGE.toString(), handleResponse);

      // Set timeout with ref tracking
      subscriptionTimeoutRef.current = setTimeout(() => {
        setSubscriptionLoading(false);
        logger.error('Project subscription timeout - no response from server');
        subscriptionTimeoutRef.current = null;
      }, 5000);
    } catch (error) {
      logger.error('Error updating project subscription:', error);
      setSubscriptionLoading(false);
    }
  }, [selectedProject, socket, subscriptionLoading, currentSession, dispatch]);

  // Memoized settings handler
  const handleSettingsClick = useCallback(() => {
    if (selectedProject?.id) {
      console.log('Opening project drawer from project view for project:', selectedProject.id);

      // Set project ID first
      dispatch(setProjectId(selectedProject.id));

      // Then fetch project data
      dispatch(fetchProjectData(selectedProject.id))
        .unwrap()
        .then(projectData => {
          console.log('Project data fetched successfully from project view:', projectData);
          // Open drawer after data is fetched
          dispatch(toggleProjectDrawer());
        })
        .catch(error => {
          console.error('Failed to fetch project data from project view:', error);
          // Still open drawer even if fetch fails, so user can see error state
          dispatch(toggleProjectDrawer());
        });
    }
  }, [dispatch, selectedProject?.id]);

  // Optimized task creation handler
  const handleCreateTask = useCallback(() => {
    if (!selectedProject?.id || !currentSession?.id || !socket) return;

    try {
      setCreatingTask(true);

      const body: Partial<ITaskCreateRequest> = {
        name: t('defaultTaskName', { defaultValue: 'Untitled Task' }),
        project_id: selectedProject.id,
        reporter_id: currentSession.id,
        team_id: currentSession.team_id,
      };

      const handleTaskCreated = (task: IProjectTask) => {
        if (task.id) {
          dispatch(setSelectedTaskId(task.id));
          dispatch(setShowTaskDrawer(true));

          const groupId = groupBy === IGroupBy.PHASE ? UNMAPPED : getGroupIdByGroupedColumn(task);
          if (groupId) {
            if (tab === 'board') {
              dispatch(addTaskCardToTheTop({ sectionId: groupId, task }));
            } else {
              dispatch(addTask({ task, groupId }));
            }
            socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
          }
        }
        setCreatingTask(false);
      };

      socket.once(SocketEvents.QUICK_TASK.toString(), handleTaskCreated);
      socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
    } catch (error) {
      logger.error('Error creating task', error);
      setCreatingTask(false);
    }
  }, [selectedProject?.id, currentSession, socket, dispatch, groupBy, tab, t]);

  // Memoized import task template handler
  const handleImportTaskTemplate = useCallback(() => {
    if (isFreeUser(currentSession)) {
      dispatch(toggleUpgradeModal());
    } else {
      dispatch(setImportTaskTemplateDrawerOpen(true));
    }
  }, [dispatch, currentSession]);

  // Memoized navigation handler
  const handleNavigateToProjects = useCallback(() => {
    navigate('/worklenz/projects');
  }, [navigate]);

  // Memoized save as template handler
  const handleSaveAsTemplate = useCallback(() => {
    if (isFreeUser(currentSession)) {
      dispatch(toggleUpgradeModal());
    } else {
      dispatch(toggleSaveAsTemplateDrawer());
    }
  }, [dispatch, currentSession]);

  // Memoized invite handler
  const handleInvite = useCallback(() => {
    dispatch(toggleProjectMemberDrawer());
  }, [dispatch]);

  // Memoized dropdown items
  const dropdownItems = useMemo(
    () => [
      {
        key: 'import',
        label: (
          <div
            style={{ width: '100%', margin: 0, padding: 0 }}
            onClick={handleImportTaskTemplate}
            title={t('importTaskTooltip', { defaultValue: 'Import task from template' })}
          >
            <ImportOutlined /> {t('importTask', { defaultValue: 'Import task' })}
          </div>
        ),
      },
    ],
    [handleImportTaskTemplate, t]
  );

  // Memoized project attributes with optimized date formatting
  const projectAttributes = useMemo(() => {
    if (!selectedProject) return null;

    const elements = [];

    if (selectedProject.category_id) {
      elements.push(
        <Tooltip
          key="category-tooltip"
          title={`${t('projectCategoryTooltip', { defaultValue: 'Project category' })}: ${selectedProject.category_name}`}
        >
          <Tag
            key="category"
            color={selectedProject.category_color || colors.vibrantOrange}
            style={{ borderRadius: 24, paddingInline: 8, margin: 0, color: '#000000' }}
          >
            {selectedProject.category_name}
          </Tag>
        </Tooltip>
      );
    }

    // ✅ UPDATED: Display status icon with name
    if (selectedProject.status) {
      elements.push(
        <Tooltip 
          key="status" 
          title={`${t('projectStatusTooltip', { defaultValue: 'Project status' })}: ${selectedProject.status}`}
        >
          <ProjectStatusIcon
            iconName={selectedProject.status_icon || ''}
            color={selectedProject.status_color || ''}
            statusName={selectedProject.status}
            showName={true}
          />
        </Tooltip>
      );
    }

    if (selectedProject.start_date || selectedProject.end_date) {
      const tooltipContent = (
        <Typography.Text style={{ color: colors.white }}>
          {t('projectDatesInfo', { defaultValue: 'Project timeline information' })}
          <br />
          {selectedProject.start_date &&
            `${t('startDate', { defaultValue: 'Start date' })}: ${formatDate(new Date(selectedProject.start_date))}`}
          {selectedProject.end_date && (
            <>
              <br />
              {`${t('endDate', { defaultValue: 'End date' })}: ${formatDate(new Date(selectedProject.end_date))}`}
            </>
          )}
        </Typography.Text>
      );

      elements.push(
        <Tooltip key="dates" title={tooltipContent}>
          <CalendarOutlined style={{ fontSize: 16 }} />
        </Tooltip>
      );
    }

    return (
      <Flex gap={4} align="center">
        {elements}
      </Flex>
    );
  }, [selectedProject, t]);

  // Memoized header actions with conditional rendering optimization
  const headerActions = useMemo(() => {
    const actions = [];

    // Refresh button
    actions.push(
      <Tooltip key="refresh" title={t('refreshTooltip', { defaultValue: 'Refresh project data' })}>
        <Button
          shape="circle"
          icon={<SyncOutlined spin={refreshLoading} />}
          onClick={handleRefresh}
          loading={refreshLoading}
        />
      </Tooltip>
    );

    // Save as template (owner/admin/team lead only)
    if (isOwnerOrAdmin) {
      actions.push(
        <Tooltip key="template" title={t('saveAsTemplateTooltip', { defaultValue: 'Save this project as a template' })}>
          <Button shape="circle" icon={<SaveOutlined />} onClick={handleSaveAsTemplate} />
        </Tooltip>
      );
    }

    // Settings button
    actions.push(
      <Tooltip key="settings" title={t('settingsTooltip', { defaultValue: 'Open project settings' })}>
        <Button shape="circle" icon={<SettingOutlined />} onClick={handleSettingsClick} />
      </Tooltip>
    );

    // Integrations button (owner/admin/team lead/project manager only)
    if (isOwnerOrAdmin || isProjectManager) {
      actions.push(
        <ProjectIntegrationsButton
          key="integrations"
          projectId={selectedProject?.id || ''}
          projectName={selectedProject?.name}
        />
      );
    }

    // Subscribe button
    actions.push(
      <Tooltip
        key="subscribe"
        title={selectedProject?.subscribed ? t('unsubscribeTooltip', { defaultValue: 'Unsubscribe from project notifications' }) : t('subscribeTooltip', { defaultValue: 'Subscribe to project notifications' })}
      >
        <Button
          shape="round"
          loading={subscriptionLoading}
          icon={selectedProject?.subscribed ? <BellFilled /> : <BellOutlined />}
          onClick={handleSubscribe}
        >
          {selectedProject?.subscribed ? t('unsubscribe', { defaultValue: 'Unsubscribe' }) : t('subscribe', { defaultValue: 'Subscribe' })}
        </Button>
      </Tooltip>
    );

    // Invite button (owner/admin/team lead/project manager only)
    if (isOwnerOrAdmin || isProjectManager) {
      actions.push(
        <Tooltip key="invite-tooltip" title={t('inviteTooltip', { defaultValue: 'Invite team members to this project' })}>
            <Button key="invite" type="primary" icon={<UsergroupAddOutlined />} onClick={handleInvite}>
              {t('invite', { defaultValue: 'Invite' })}
            </Button>
        </Tooltip>
      );
    }

    // Create task button
    if (isOwnerOrAdmin) {
      actions.push(
        <Tooltip key="create-task-tooltip" title={t('createTaskTooltip', { defaultValue: 'Create a new task' })}>
          <Dropdown.Button
            key="create-task-dropdown"
            loading={creatingTask}
            type="primary"
            icon={<DownOutlined />}
            menu={{ items: dropdownItems }}
            trigger={['click']}
            onClick={handleCreateTask}
          >
            <EditOutlined /> {t('createTask', { defaultValue: 'Create task' })}
          </Dropdown.Button>
        </Tooltip>
      );
    } else {
      actions.push(
        <Tooltip key="create-task-tooltip" title={t('createTaskTooltip', { defaultValue: 'Create a new task' })}>
          <Button
            key="create-task"
            loading={creatingTask}
            type="primary"
            icon={<EditOutlined />}
            onClick={handleCreateTask}
          >
            {t('createTask', { defaultValue: 'Create task' })}
          </Button>
        </Tooltip>
      );
    }

    return (
      <Flex gap={4} align="center">
        {actions}
      </Flex>
    );
  }, [
    refreshLoading,
    handleRefresh,
    isOwnerOrAdmin,
    handleSaveAsTemplate,
    handleSettingsClick,
    t,
    subscriptionLoading,
    selectedProject?.subscribed,
    handleSubscribe,
    isProjectManager,
    handleInvite,
    creatingTask,
    dropdownItems,
    handleCreateTask,
  ]);

  // Memoized page header title with hover effect on back button
  const pageHeaderTitle = useMemo(
    () => (
      <Flex gap={4} align="center">
        <Tooltip title={t('navigateBackTooltip', { defaultValue: 'Go back to projects list' })}>
          <ArrowLeftOutlined
            style={{ 
              fontSize: 16, 
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
              color: isBackButtonHovered ? '#1890ff' : 'inherit',
            }}
            onMouseEnter={() => setIsBackButtonHovered(true)}
            onMouseLeave={() => setIsBackButtonHovered(false)}
            onClick={handleNavigateToProjects}
          />
        </Tooltip>
        <Typography.Title level={4} style={{ marginBlockEnd: 0, marginInlineStart: 8 }}>
          {selectedProject?.name}
        </Typography.Title>
        {projectAttributes}
      </Flex>
    ),
    [handleNavigateToProjects, selectedProject?.name, projectAttributes, t, isBackButtonHovered]
  );

  // Memoized page header styles
  const pageHeaderStyle = useMemo(
    () => ({
      paddingInline: 0,
    }),
    []
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        className="site-page-header"
        style={{
          ...pageHeaderStyle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 0',
          marginBottom: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {pageHeaderTitle}
        </div>
        <div style={{ marginLeft: '16px', flexShrink: 0 }}>
          {headerActions}
        </div>
      </div>
      {createPortal(<ProjectDrawer onClose={() => {}} />, document.body, 'project-drawer')}
      {createPortal(<ImportTaskTemplate />, document.body, 'import-task-template')}
      {createPortal(<SaveProjectAsTemplate />, document.body, 'save-project-as-template')}
    </>
  );
});

ProjectViewHeader.displayName = 'ProjectViewHeader';

export default ProjectViewHeader;