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
import { PageHeader } from '@ant-design/pro-components';
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
import ProjectDrawer from '@/components/projects/project-drawer/project-drawer';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { addTaskCardToTheTop, fetchBoardTaskGroups } from '@/features/board/board-slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { ShareAltOutlined } from '@/shared/antd-imports';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';

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

  // Use ref to track subscription timeout
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized refresh handler with optimized dependencies
  const handleRefresh = useCallback(() => {
    if (!projectId) return;

    dispatch(getProject(projectId));

    switch (tab) {
      case 'tasks-list':
        dispatch(fetchStatuses(projectId));
        dispatch(fetchTaskListColumns(projectId));
        dispatch(fetchPhasesByProjectId(projectId));
        dispatch(fetchTasksV3(projectId));
        break;
      case 'board':
        dispatch(fetchEnhancedKanbanGroups(projectId));
        break;
      case 'project-insights-member-overview':
      case 'all-attachments':
      case 'members':
      case 'updates':
        dispatch(setRefreshTimestamp());
        break;
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
        name: t('defaultTaskName'),
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
    dispatch(setImportTaskTemplateDrawerOpen(true));
  }, [dispatch]);

  // Memoized navigation handler
  const handleNavigateToProjects = useCallback(() => {
    navigate('/worklenz/projects');
  }, [navigate]);

  // Memoized save as template handler
  const handleSaveAsTemplate = useCallback(() => {
    dispatch(toggleSaveAsTemplateDrawer());
  }, [dispatch]);

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
            title={t('importTaskTooltip')}
          >
            <ImportOutlined /> {t('importTask')}
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
          title={`${t('projectCategoryTooltip')}: ${selectedProject.category_name}`}
        >
          <Tag
            key="category"
            color={colors.vibrantOrange}
            style={{ borderRadius: 24, paddingInline: 8, margin: 0 }}
          >
            {selectedProject.category_name}
          </Tag>
        </Tooltip>
      );
    }

    if (selectedProject.status) {
      elements.push(
        <Tooltip key="status" title={`${t('projectStatusTooltip')}: ${selectedProject.status}`}>
          <ProjectStatusIcon
            iconName={selectedProject.status_icon || ''}
            color={selectedProject.status_color || ''}
          />
        </Tooltip>
      );
    }

    if (selectedProject.start_date || selectedProject.end_date) {
      const tooltipContent = (
        <Typography.Text style={{ color: colors.white }}>
          {t('projectDatesInfo')}
          <br />
          {selectedProject.start_date &&
            `${t('startDate')}: ${formatDate(new Date(selectedProject.start_date))}`}
          {selectedProject.end_date && (
            <>
              <br />
              {`${t('endDate')}: ${formatDate(new Date(selectedProject.end_date))}`}
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

    if (selectedProject.notes) {
      elements.push(
        <Typography.Text key="notes" type="secondary">
          {selectedProject.notes}
        </Typography.Text>
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
      <Tooltip key="refresh" title={t('refreshTooltip')}>
        <Button
          shape="circle"
          icon={<SyncOutlined spin={loadingGroups} />}
          onClick={handleRefresh}
        />
      </Tooltip>
    );

    // Save as template (owner/admin/team lead only)
    if (isOwnerOrAdmin) {
      actions.push(
        <Tooltip key="template" title={t('saveAsTemplateTooltip')}>
          <Button shape="circle" icon={<SaveOutlined />} onClick={handleSaveAsTemplate} />
        </Tooltip>
      );
    }

    // Settings button
    actions.push(
      <Tooltip key="settings" title={t('settingsTooltip')}>
        <Button shape="circle" icon={<SettingOutlined />} onClick={handleSettingsClick} />
      </Tooltip>
    );

    // Subscribe button
    actions.push(
      <Tooltip
        key="subscribe"
        title={selectedProject?.subscribed ? t('unsubscribeTooltip') : t('subscribeTooltip')}
      >
        <Button
          shape="round"
          loading={subscriptionLoading}
          icon={selectedProject?.subscribed ? <BellFilled /> : <BellOutlined />}
          onClick={handleSubscribe}
        >
          {selectedProject?.subscribed ? t('unsubscribe') : t('subscribe')}
        </Button>
      </Tooltip>
    );

    // Invite button (owner/admin/team lead/project manager only)
    if (isOwnerOrAdmin || isProjectManager) {
      actions.push(
        <Tooltip key="invite-tooltip" title={t('inviteTooltip')}>
          <Button key="invite" type="primary" icon={<ShareAltOutlined />} onClick={handleInvite}>
            {t('share')}
          </Button>
        </Tooltip>
      );
    }

    // Create task button
    if (isOwnerOrAdmin) {
      actions.push(
        <Tooltip key="create-task-tooltip" title={t('createTaskTooltip')}>
          <Dropdown.Button
            key="create-task-dropdown"
            loading={creatingTask}
            type="primary"
            icon={<DownOutlined />}
            menu={{ items: dropdownItems }}
            trigger={['click']}
            onClick={handleCreateTask}
          >
            <EditOutlined /> {t('createTask')}
          </Dropdown.Button>
        </Tooltip>
      );
    } else {
      actions.push(
        <Tooltip key="create-task-tooltip" title={t('createTaskTooltip')}>
          <Button
            key="create-task"
            loading={creatingTask}
            type="primary"
            icon={<EditOutlined />}
            onClick={handleCreateTask}
          >
            {t('createTask')}
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
    loadingGroups,
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

  // Memoized page header title
  const pageHeaderTitle = useMemo(
    () => (
      <Flex gap={4} align="center">
        <Tooltip title={t('navigateBackTooltip')}>
          <ArrowLeftOutlined
            style={{ fontSize: 16, cursor: 'pointer' }}
            onClick={handleNavigateToProjects}
          />
        </Tooltip>
        <Typography.Title level={4} style={{ marginBlockEnd: 0, marginInlineStart: 8 }}>
          {selectedProject?.name}
        </Typography.Title>
        {projectAttributes}
      </Flex>
    ),
    [handleNavigateToProjects, selectedProject?.name, projectAttributes, t]
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
      <PageHeader
        className="site-page-header"
        title={pageHeaderTitle}
        style={pageHeaderStyle}
        extra={headerActions}
      />
      {createPortal(<ProjectDrawer onClose={() => {}} />, document.body, 'project-drawer')}
      {createPortal(<ImportTaskTemplate />, document.body, 'import-task-template')}
      {createPortal(<SaveProjectAsTemplate />, document.body, 'save-project-as-template')}
    </>
  );
});

ProjectViewHeader.displayName = 'ProjectViewHeader';

export default ProjectViewHeader;
