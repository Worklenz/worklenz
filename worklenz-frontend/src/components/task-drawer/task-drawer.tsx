import { DeferredMount } from '@/components/task-list-v2/components/DeferredMount';
import { TabsProps, Tabs, Button, Result, Alert, Flex, Tooltip } from '@/shared/antd-imports';
import Drawer from 'antd/es/drawer';
import { InputRef } from 'antd/es/input';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { PlusOutlined, CloseOutlined, ArrowLeftOutlined } from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  setTaskFormViewModel,
  setTaskSubscribers,
  setTimeLogEditing,
  setTargetDrawerTab,
  fetchTask,
  setTaskAccessFrom,
} from '@/features/task-drawer/task-drawer.slice';

import './task-drawer.css';
import TaskDrawerHeader from './task-drawer-header/task-drawer-header';
import TaskDrawerTitleSection from './task-drawer-title-section/task-drawer-title-section';
import TaskDrawerActivityLog from './shared/activity-log/task-drawer-activity-log';
import TaskDrawerInfoTab from './shared/info-tab/task-drawer-info-tab';
import TaskDrawerTimeLog from './shared/time-log/task-drawer-time-log';
import TimeLogForm from './shared/time-log/time-log-form';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import useTaskDrawerUrlSync from '@/hooks/useTaskDrawerUrlSync';
import useTaskDrawerNavigation from '@/hooks/useTaskDrawerNavigation';
import InfoTabFooter from './shared/info-tab/info-tab-footer';
import { CrownOutlined } from '@ant-design/icons';
import { useAuthService } from '@/hooks/useAuth';
import { isFreeUser } from '@/utils/subscription-utils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { getProject } from '@/features/project/project.slice';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import CustomColumnModal from '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-modal';

const TaskDrawer = () => {
  const { t, ready } = useTranslation('task-drawer/task-drawer');
  const { t: tCommon } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<string>('info');
  const [refreshTimeLogTrigger, setRefreshTimeLogTrigger] = useState(0);
  const { canCreateTask } = useTaskCreationPermission();
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const timeLogEditing = useAppSelector(state => state.taskDrawerReducer.timeLogEditing);
  const taskAccessDenied = useAppSelector(state => state.taskDrawerReducer.taskAccessDenied);
  const taskAccessFrom = useAppSelector(state => state.taskDrawerReducer.taskAccessFrom);
  const targetDrawerTab = useAppSelector(state => state.taskDrawerReducer.targetDrawerTab);
  const lastDeletedTaskId = useAppSelector(state => state.taskDrawerReducer.lastDeletedTaskId);
  const taskFormViewModel = useAppSelector(state => state.taskDrawerReducer.taskFormViewModel);
  const selectedTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const project = useAppSelector(state => state.projectReducer.project);
  const priorityCount = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer ? state.priorityReducer.priorities.length : 0);
  const labelCount = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer ? state.taskLabelsReducer.labels.length : 0);
  const memberCount = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer ? (state.teamMembersReducer.teamMembers?.data?.length || 0) : 0);

  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isFree = isFreeUser(currentSession);
  const taskNameInputRef = useRef<InputRef>(null);
  const isClosingManually = useRef(false);
  const hydratedProjectIdRef = useRef<string | null>(null);

  // Check if user is a guest in this project
  const isGuest = project?.is_guest === true;
  // TVR-13: parent of assigned-only subtask is view-only
  const isAssigneeScopeReadonly = !!taskFormViewModel?.task?.assignee_scope_readonly;
  const isTaskReadOnly = isGuest || isAssigneeScopeReadonly;
  const isSoftwareProject = isSoftwareProjectType(project?.project_type);

  const { clearTaskFromUrl } = useTaskDrawerUrlSync();
  useTaskDrawerNavigation();

  useEffect(() => {
    if (taskNameInputRef.current?.input?.value === DEFAULT_TASK_NAME) {
      taskNameInputRef.current.focus();
    }
  }, [showTaskDrawer]);

  const dispatch = useAppDispatch();

  // Deep-link: open a specific drawer tab (e.g. Time Log from recent logs)
  // Only apply targetDrawerTab after the correct task has been loaded (selectedTaskId is set)
  useEffect(() => {
    if (!showTaskDrawer || !targetDrawerTab || !selectedTaskId) return;

    if (isSoftwareProject) {
      dispatch(setTargetDrawerTab(null));
      return;
    }

    if (isFree && (targetDrawerTab === 'timeLog' || targetDrawerTab === 'activityLog')) {
      dispatch(toggleUpgradeModal());
      dispatch(setTargetDrawerTab(null));
      return;
    }

    setActiveTab(targetDrawerTab);
    dispatch(setTargetDrawerTab(null));
  }, [showTaskDrawer, targetDrawerTab, selectedTaskId, isFree, isSoftwareProject, dispatch]);

  useEffect(() => {
    if (!showTaskDrawer || taskAccessDenied) return;

    if (!priorityCount) {
      dispatch(fetchPriorities());
    }

    if (!labelCount) {
      dispatch(fetchLabels());
    }

    if (!memberCount) {
      dispatch(
        getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true })
      );
    }

    if (projectId) {
      if (hydratedProjectIdRef.current !== projectId) {
        hydratedProjectIdRef.current = projectId;
        dispatch(fetchPhasesByProjectId(projectId));
      }

      if (project?.id !== projectId) {
        dispatch(getProject(projectId));
      }

      if (
        selectedTaskId &&
        selectedTaskId !== lastDeletedTaskId &&
        (
          taskFormViewModel?.task?.id !== selectedTaskId ||
          !taskFormViewModel?.task?.name
        )
      ) {
        dispatch(
          fetchTask({
            taskId: selectedTaskId,
            projectId,
            from: taskAccessFrom,
          })
        );
      }
    }
  }, [
    dispatch,
    labelCount,
    lastDeletedTaskId,
    priorityCount,
    project,
    projectId,
    selectedTaskId,
    showTaskDrawer,
    taskAccessDenied,
    taskAccessFrom,
    taskFormViewModel?.task?.id,
    taskFormViewModel?.task?.name,
    memberCount,
  ]);

  const handleBackToParent = () => {
    if (taskFormViewModel?.task?.parent_task_id && projectId) {
      const accessFrom = taskAccessFrom;
      dispatch(setSelectedTaskId(taskFormViewModel.task.parent_task_id));
      dispatch(setTaskAccessFrom(accessFrom));
      dispatch(
        fetchTask({
          taskId: taskFormViewModel.task.parent_task_id,
          projectId,
          from: accessFrom,
        })
      );
    }
  };

  const handleOnClose = (
    e?: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element>
  ) => {
    isClosingManually.current = true;
    setActiveTab('info');
    clearTaskFromUrl();

    const isClickOutsideDrawer =
      e?.target && (e.target as HTMLElement).classList.contains('ant-drawer-mask');

    if (isClickOutsideDrawer || taskAccessDenied || !taskFormViewModel?.task?.is_sub_task) {
      dispatch(setShowTaskDrawer(false));
    } else {
      handleBackToParent();
    }

    setTimeout(() => {
      isClosingManually.current = false;
    }, 100);
  };

  const handleAfterOpenChange = (open: boolean) => {
    if (!open) {
      dispatch(setSelectedTaskId(null));
      dispatch(setTaskFormViewModel({}));
      dispatch(setTaskSubscribers([]));
    }
  };

  const handleTabChange = (key: string) => {
    if (isFree && (key === 'timeLog' || key === 'activityLog')) {
      dispatch(toggleUpgradeModal());
      return;
    }
    setActiveTab(key);
  };

  const handleCancelTimeLog = () => {
    dispatch(setTimeLogEditing({ isEditing: false, logBeingEdited: null }));
  };

  const handleAddTimeLog = () => {
    if (isTaskReadOnly) return;
    dispatch(setTimeLogEditing({ isEditing: true, logBeingEdited: null }));
  };

  const refreshTimeLogs = () => setRefreshTimeLogTrigger(prev => prev + 1);

  const handleTimeLogSubmitSuccess = () => {
    handleCancelTimeLog();
    refreshTimeLogs();
  };

  const handlePremiumTabClick = () => dispatch(toggleUpgradeModal());

  const tabItems: TabsProps['items'] = [
    {
      key: 'info',
      label: t('taskInfoTab.title', { defaultValue: 'Info' }),
      children: <TaskDrawerInfoTab t={t} canCreateTask={canCreateTask} isGuest={isTaskReadOnly} />,
    },
    {
      key: 'timeLog',
      label: isFree ? (
        <Tooltip title={tCommon('upgrade-plan', { defaultValue: 'Upgrade Plan' })} placement="top">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            onClick={handlePremiumTabClick}
          >
            <span>{t('taskTimeLogTab.title', { defaultValue: 'Time Log' })}</span>
            <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
          </div>
        </Tooltip>
      ) : (
        t('taskTimeLogTab.title', { defaultValue: 'Time Log' })
      ),
      children: (
        <TaskDrawerTimeLog t={t} refreshTrigger={refreshTimeLogTrigger} isGuest={isTaskReadOnly} />
      ),
      disabled: isFree,
    },
    {
      key: 'activityLog',
      label: isFree ? (
        <Tooltip title={tCommon('upgrade-plan', { defaultValue: 'Upgrade Plan' })} placement="top">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            onClick={handlePremiumTabClick}
          >
            <span>{t('taskActivityLogTab.title', { defaultValue: 'Activity Log' })}</span>
            <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
          </div>
        </Tooltip>
      ) : (
        t('taskActivityLogTab.title', { defaultValue: 'Activity Log' })
      ),
      children: <TaskDrawerActivityLog />,
      disabled: isFree,
    },
  ];

  const renderFooter = () => {
    if (taskAccessDenied) return null;
    if (activeTab === 'info' || isSoftwareProject) return <InfoTabFooter />;
    if (activeTab === 'timeLog') {
      if (isTaskReadOnly) return null;
      if (timeLogEditing.isEditing) {
        return (
          <TimeLogForm
            onCancel={handleCancelTimeLog}
            onSubmitSuccess={handleTimeLogSubmitSuccess}
            initialValues={timeLogEditing.logBeingEdited || undefined}
            mode={timeLogEditing.logBeingEdited ? 'edit' : 'create'}
            allowReassign={!!timeLogEditing.logBeingEdited}

          />
        );
      }
      return (
        <Flex justify="center" style={{ width: '100%', padding: '16px 0 0' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddTimeLog}
            style={{ width: '100%' }}
            disabled={isTaskReadOnly}
          >
            {t('taskTimeLogTab.addTimeLog', { defaultValue: 'Add Time Log' })}
          </Button>
        </Flex>
      );
    }
    return null;
  };

  const isSubTask =
    taskFormViewModel?.task?.is_sub_task || !!taskFormViewModel?.task?.parent_task_id;

  const drawerProps = {
    open: showTaskDrawer,
    onClose: handleOnClose,
    maskClosable: false,
    mask: false,
    afterOpenChange: handleAfterOpenChange,
    width: isSoftwareProject ? SOFTWARE_DRAWER_WIDTH : 720,
    destroyOnHidden: false,
    title: taskAccessDenied ? (
      t('taskAccessDenied.title', { defaultValue: 'No access' })
    ) : (
      <TaskDrawerHeader t={t} canCreateTask={canCreateTask} isGuest={isTaskReadOnly} />
    ),
    closeIcon: !taskAccessDenied && isSubTask ? <ArrowLeftOutlined /> : <CloseOutlined />,
    footer: renderFooter(),
    styles: {
      body: {
        padding: 0,
        overflow: 'auto',
        height:
          activeTab === 'timeLog' && timeLogEditing.isEditing
            ? 'calc(100% - 220px)'
            : 'calc(100% - 180px)',
      },
      footer: {
        padding: '0 24px 16px',
        width: '100%',
        height: 'auto',
        boxSizing: 'border-box' as const,
        overflow: activeTab === 'timeLog' ? 'visible' : 'hidden',
      },
    },
  };

  return (
    <>
      <DeferredMount isOpen={showTaskDrawer}><Drawer {...drawerProps}>
        {taskAccessDenied ? (
          <div style={{ padding: '48px 24px' }} role="status" aria-live="polite">
            <Result
              status="403"
              title={t('taskAccessDenied.title', { defaultValue: 'No access' })}
              subTitle={t('taskAccessDenied.subtitle', {
                defaultValue:
                  'You can only open tasks assigned to you in this project. Ask a project manager to assign you if you need access.',
              })}
              extra={
                <Button type="primary" onClick={() => handleOnClose()}>
                  {t('taskAccessDenied.close', { defaultValue: 'Close' })}
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {isAssigneeScopeReadonly && (
              <div style={{ padding: '12px 24px 0' }} role="status">
                <Alert
                  type="info"
                  showIcon
                  message={t('assigneeScopeReadonly.title', {
                    defaultValue: 'View only',
                  })}
                  description={t('assigneeScopeReadonly.description', {
                    defaultValue:
                      'You are assigned to a subtask of this task. You can view the parent for context but cannot edit it.',
                  })}
                />
              </div>
            )}
            {/* Project name + task name — below the header, above the tabs */}
            <TaskDrawerTitleSection
              inputRef={taskNameInputRef}
              t={t}
              canCreateTask={canCreateTask && !isTaskReadOnly}
            />

            <div style={{ padding: '0 24px' }}>
              {isSoftwareProject ? (
                <TaskDrawerInfoTab t={t} canCreateTask={canCreateTask} isGuest={isTaskReadOnly} />
              ) : (
                <Tabs type="card" items={tabItems} onChange={handleTabChange} activeKey={activeTab} />
              )}
            </div>
          </>
        )}
      </Drawer></DeferredMount>
      {createPortal(
        <CustomColumnModal projectId={projectId} />,
        document.body,
        'task-drawer-custom-column-modal'
      )}
    </>
  );
};

const SOFTWARE_DRAWER_WIDTH = 'min(520px, 100vw)';

export default TaskDrawer;
