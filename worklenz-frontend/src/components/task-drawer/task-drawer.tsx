import { TabsProps, Tabs, Button } from '@/shared/antd-imports';
import Drawer from 'antd/es/drawer';
import { InputRef } from 'antd/es/input';
import { useTranslation } from 'react-i18next';
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
  fetchTask,
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
import { Flex, Tooltip } from '@/shared/antd-imports';
import { CrownOutlined } from '@ant-design/icons';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { getProject } from '@/features/project/project.slice';

const TaskDrawer = () => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const { t: tCommon } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<string>('info');
  const [refreshTimeLogTrigger, setRefreshTimeLogTrigger] = useState(0);
  const { canCreateTask } = useTaskCreationPermission();
  const { showTaskDrawer, timeLogEditing } = useAppSelector(state => state.taskDrawerReducer);
  const { taskFormViewModel, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId, project } = useAppSelector(state => state.projectReducer);
  const priorities = useAppSelector(state => state.priorityReducer.priorities);
  const labels = useAppSelector(state => state.taskLabelsReducer.labels);
  const teamMembers = useAppSelector(state => state.teamMembersReducer.teamMembers);

  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const { isFreeUser: isFree } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const taskNameInputRef = useRef<InputRef>(null);
  const isClosingManually = useRef(false);
  const hydratedProjectIdRef = useRef<string | null>(null);

  const { clearTaskFromUrl } = useTaskDrawerUrlSync();
  useTaskDrawerNavigation();

  useEffect(() => {
    if (taskNameInputRef.current?.input?.value === DEFAULT_TASK_NAME) {
      taskNameInputRef.current.focus();
    }
  }, [showTaskDrawer]);

  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!showTaskDrawer) return;

    if (!priorities.length) {
      dispatch(fetchPriorities());
    }

    if (!labels.length) {
      dispatch(fetchLabels());
    }

    if (!teamMembers?.data?.length) {
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

      if (selectedTaskId && taskFormViewModel?.task?.id !== selectedTaskId) {
        dispatch(fetchTask({ taskId: selectedTaskId, projectId }));
      }
    }
  }, [
    dispatch,
    labels.length,
    priorities.length,
    project,
    projectId,
    selectedTaskId,
    showTaskDrawer,
    taskFormViewModel?.task?.id,
    teamMembers?.data?.length,
  ]);

  const handleBackToParent = () => {
    if (taskFormViewModel?.task?.parent_task_id && projectId) {
      dispatch(setSelectedTaskId(taskFormViewModel.task.parent_task_id));
      dispatch(fetchTask({ taskId: taskFormViewModel.task.parent_task_id, projectId }));
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

    if (isClickOutsideDrawer || !taskFormViewModel?.task?.is_sub_task) {
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
      promptUpgrade();
      return;
    }
    setActiveTab(key);
  };

  const handleCancelTimeLog = () => {
    dispatch(setTimeLogEditing({ isEditing: false, logBeingEdited: null }));
  };

  const handleAddTimeLog = () => {
    dispatch(setTimeLogEditing({ isEditing: true, logBeingEdited: null }));
  };

  const refreshTimeLogs = () => setRefreshTimeLogTrigger(prev => prev + 1);

  const handleTimeLogSubmitSuccess = () => {
    handleCancelTimeLog();
    refreshTimeLogs();
  };

  const handlePremiumTabClick = () => promptUpgrade();

  const tabItems: TabsProps['items'] = [
    {
      key: 'info',
      label: t('taskInfoTab.title', { defaultValue: 'Info' }),
      children: <TaskDrawerInfoTab t={t} canCreateTask={canCreateTask} />,
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
      children: <TaskDrawerTimeLog t={t} refreshTrigger={refreshTimeLogTrigger} />,
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
    if (activeTab === 'info') return <InfoTabFooter />;
    if (activeTab === 'timeLog') {
      if (timeLogEditing.isEditing) {
        return (
          <TimeLogForm
            onCancel={handleCancelTimeLog}
            onSubmitSuccess={handleTimeLogSubmitSuccess}
            initialValues={timeLogEditing.logBeingEdited || undefined}
            mode={timeLogEditing.logBeingEdited ? 'edit' : 'create'}
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
    width: 720,
    destroyOnClose: false,
    title: <TaskDrawerHeader t={t} canCreateTask={canCreateTask} />,
    closeIcon: isSubTask ? <ArrowLeftOutlined /> : <CloseOutlined />,
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
    <Drawer {...drawerProps}>
      {/* Project name + task name — below the header, above the tabs */}
      <TaskDrawerTitleSection inputRef={taskNameInputRef} t={t} />

      {/* Tabs */}
      <div style={{ padding: '0 24px' }}>
        <Tabs type="card" items={tabItems} onChange={handleTabChange} activeKey={activeTab} />
      </div>
    </Drawer>
  );
};

export default TaskDrawer;
