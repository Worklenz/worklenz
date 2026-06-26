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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';


import { colors } from '@/styles/colors';
import { getContrastColor } from '@/utils/colorUtils';
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
import { ProjectDrawer } from '@/components/projects/project-drawer/project-drawer';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { addTaskCardToTheTop, fetchBoardTaskGroups } from '@/features/board/board-slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { fetchTasksV3, setLoading } from '@/features/task-management/task-management.slice';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { ProjectIntegrationsButton } from '@/components/projects/integrations/ProjectIntegrationsButton';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';

const ProjectViewHeader = memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation('project-view/project-view-header');
  const dispatch = useAppDispatch();
  const { tab } = useTabSearchParam();
  const { canCreateTask } = useTaskCreationPermission();
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const { isFreeUser: isFree } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const isOwnerOrAdmin = useMemo(() => authService.isOwnerOrAdmin(), [authService]);
  const isProjectManager = useIsProjectManager();

  const { socket } = useSocket();

  const selectedProject = useAppSelector(state => state.projectReducer.project);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const loadingGroups = useAppSelector(state => state.taskReducer.loadingGroups);
  const groupBy = useAppSelector(state => state.taskReducer.groupBy);

  const [creatingTask, setCreatingTask] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const projectTasksFetching = useAppSelector(state => state.taskManagement.loading);
  const [isBackButtonHovered, setIsBackButtonHovered] = useState(false);

  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRefresh = useCallback(() => {
    if (!projectId) return;
    dispatch(setLoading(true));

    const run = async () => {
      try {
        const projectPromise = dispatch(getProject(projectId)).unwrap();
        switch (tab) {
          case 'tasks-list':
            await Promise.allSettled([
              projectPromise,
              dispatch(fetchStatuses(projectId)).unwrap(),
              dispatch(fetchTaskListColumns(projectId)).unwrap(),
              dispatch(fetchPhasesByProjectId(projectId)).unwrap(),
              dispatch(fetchTasksV3(projectId)).unwrap(),
            ]);
            break;
          case 'board':
            await Promise.allSettled([
              projectPromise,
              dispatch(fetchEnhancedKanbanGroups(projectId)).unwrap(),
            ]);
            break;
          case 'workload':
          case 'roadmap':
          case 'finance':
          case 'project-insights-member-overview':
          case 'all-attachments':
          case 'members':
          case 'updates':
            await Promise.all([
              projectPromise,
              new Promise(resolve => setTimeout(resolve, 1000)), // minimum 1s spin
            ]);
            dispatch(setRefreshTimestamp());
            break;
        }
      } catch (error) {
        logger.error('Error refreshing project data:', error);
      } finally {
        dispatch(setLoading(false));
      }
    };

    run();
  }, [dispatch, projectId, tab]);
  const handleSubscribe = useCallback(() => {
    if (!selectedProject?.id || !socket || subscriptionLoading) return;

    try {
      setSubscriptionLoading(true);
      const newSubscriptionState = !selectedProject.subscribed;

      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
      }

      socket.emit(SocketEvents.PROJECT_SUBSCRIBERS_CHANGE.toString(), {
        project_id: selectedProject.id,
        user_id: currentSession?.id,
        team_member_id: currentSession?.team_member_id,
        mode: newSubscriptionState ? 0 : 1,
      });

      const handleResponse = (response: any) => {
        try {
          dispatch(setProject({ ...selectedProject, subscribed: newSubscriptionState }));
        } catch (error) {
          logger.error('Error handling project subscription response:', error);
          dispatch(setProject({ ...selectedProject, subscribed: selectedProject.subscribed }));
        } finally {
          setSubscriptionLoading(false);
          if (subscriptionTimeoutRef.current) {
            clearTimeout(subscriptionTimeoutRef.current);
            subscriptionTimeoutRef.current = null;
          }
        }
      };

      socket.once(SocketEvents.PROJECT_SUBSCRIBERS_CHANGE.toString(), handleResponse);

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

  const handleSettingsClick = useCallback(() => {
    if (selectedProject?.id) {
      console.log('Opening project drawer from project view for project:', selectedProject.id);
      dispatch(setProjectId(selectedProject.id));
      dispatch(fetchProjectData(selectedProject.id))
        .unwrap()
        .then(projectData => {
          console.log('Project data fetched successfully from project view:', projectData);
          dispatch(toggleProjectDrawer());
        })
        .catch(error => {
          console.error('Failed to fetch project data from project view:', error);
          dispatch(toggleProjectDrawer());
        });
    }
  }, [dispatch, selectedProject?.id]);

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

  const handleImportTaskTemplate = useCallback(() => {
    if (isFree) {
      promptUpgrade();
    } else {
      dispatch(setImportTaskTemplateDrawerOpen(true));
    }
  }, [dispatch, currentSession]);

  const handleNavigateToProjects = useCallback(() => {
    navigate('/worklenz/projects');
  }, [navigate]);

  const handleSaveAsTemplate = useCallback(() => {
    if (isFree) {
      promptUpgrade();
    } else {
      dispatch(toggleSaveAsTemplateDrawer());
    }
  }, [dispatch, currentSession]);

  const handleInvite = useCallback(() => {
    dispatch(toggleProjectMemberDrawer());
  }, [dispatch]);

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

  const projectAttributes = useMemo(() => {
    if (!selectedProject) return null;

    const elements = [];

    if (selectedProject.category_id) {
      const bgColor = selectedProject.category_color || colors.vibrantOrange;
      const textColor = getContrastColor(bgColor);
      elements.push(
        <Tooltip
          key="category-tooltip"
          title={`${t('projectCategoryTooltip', { defaultValue: 'Project category' })}: ${selectedProject.category_name}`}
        >
          <Tag
            key="category"
            style={{
              backgroundColor: bgColor,
              border: 'none',
              margin: 0,
            }}
          >
            <span style={{ fontSize: 12, color: textColor }}>{selectedProject.category_name}</span>
          </Tag>
        </Tooltip>
      );
    }

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

  const headerActions = useMemo(() => {
    const actions = [];

    if (isOwnerOrAdmin) {
      actions.push(
        <Tooltip
          key="template"
          title={t('saveAsTemplateTooltip', { defaultValue: 'Save this project as a template' })}
        >
          <Button shape="circle" icon={<SaveOutlined />} onClick={handleSaveAsTemplate} />
        </Tooltip>
      );
    }

    actions.push(
      <Tooltip
        key="settings"
        title={t('settingsTooltip', { defaultValue: 'Open project settings' })}
      >
        <Button shape="circle" icon={<SettingOutlined />} onClick={handleSettingsClick} />
      </Tooltip>
    );

    if (isOwnerOrAdmin || isProjectManager) {
      actions.push(
        <ProjectIntegrationsButton
          key="integrations"
          projectId={selectedProject?.id || ''}
          projectName={selectedProject?.name}
        />
      );
    }

    actions.push(
      <Tooltip
        key="subscribe"
        title={
          selectedProject?.subscribed
            ? t('unsubscribeTooltip', { defaultValue: 'Unsubscribe from project notifications' })
            : t('subscribeTooltip', { defaultValue: 'Subscribe to project notifications' })
        }
      >
        <Button
          shape="round"
          loading={subscriptionLoading}
          icon={selectedProject?.subscribed ? <BellFilled /> : <BellOutlined />}
          onClick={handleSubscribe}
        >
          {selectedProject?.subscribed
            ? t('unsubscribe', { defaultValue: 'Unsubscribe' })
            : t('subscribe', { defaultValue: 'Subscribe' })}
        </Button>
      </Tooltip>
    );

    if (isOwnerOrAdmin || isProjectManager) {
      actions.push(
        <Tooltip
          key="invite-tooltip"
          title={t('inviteTooltip', { defaultValue: 'Invite team members to this project' })}
        >
          <Button
            key="invite"
            type="primary"
            icon={<UsergroupAddOutlined />}
            onClick={handleInvite}
          >
            {t('invite', { defaultValue: 'Invite' })}
          </Button>
        </Tooltip>
      );
    }

    if (isOwnerOrAdmin) {
      actions.push(
        <Tooltip
          key="create-task-tooltip"
          title={t('createTaskTooltip', { defaultValue: 'Create a new task' })}
        >
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
    } else if (canCreateTask) {
      actions.push(
        <Tooltip
          key="create-task-tooltip"
          title={t('createTaskTooltip', { defaultValue: 'Create a new task' })}
        >
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
    // refreshLoading,
    // handleRefresh,
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
          paddingInline: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 0',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>{pageHeaderTitle}</div>
        <Flex gap={4} align="center" style={{ marginLeft: '16px', flexShrink: 0 }}>
          <Tooltip title={t('refreshTooltip', { defaultValue: 'Refresh project data' })}>
            <Button
              shape="circle"
              icon={<SyncOutlined spin={projectTasksFetching} />}
              onClick={handleRefresh}
            />
          </Tooltip>
          {headerActions}
        </Flex>
      </div>
      {createPortal(<ProjectDrawer onClose={() => { }} />, document.body, 'project-drawer')}
      {createPortal(<ImportTaskTemplate />, document.body, 'import-task-template')}
      {createPortal(<SaveProjectAsTemplate />, document.body, 'save-project-as-template')}
    </>
  );
});

ProjectViewHeader.displayName = 'ProjectViewHeader';

export default ProjectViewHeader;
