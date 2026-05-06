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
import { isFreeUser } from '@/utils/subscription-utils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

const TaskDrawer = () => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const { t: tCommon } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<string>('info');
  const [refreshTimeLogTrigger, setRefreshTimeLogTrigger] = useState(0);

  const { showTaskDrawer, timeLogEditing } = useAppSelector(state => state.taskDrawerReducer);
  const { taskFormViewModel, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isFree = isFreeUser(currentSession);
  const taskNameInputRef = useRef<InputRef>(null);
  const isClosingManually = useRef(false);

  const { clearTaskFromUrl } = useTaskDrawerUrlSync();
  useTaskDrawerNavigation();

  useEffect(() => {
    if (taskNameInputRef.current?.input?.value === DEFAULT_TASK_NAME) {
      taskNameInputRef.current.focus();
    }
  }, [showTaskDrawer]);

  const dispatch = useAppDispatch();

  const handleBackToParent = () => {
    if (taskFormViewModel?.task?.parent_task_id && projectId) {
      dispatch(setSelectedTaskId(taskFormViewModel.task.parent_task_id));
      dispatch(
        fetchTask({
          taskId: taskFormViewModel.task.parent_task_id,
          projectId,
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

    if (isClickOutsideDrawer || !taskFormViewModel?.task?.is_sub_task) {
      // FIX: Only hide the drawer here. Do NOT reset selectedTaskId or
      // taskFormViewModel in onClose (or in a setTimeout inside it).
      // Previously, resetTaskState() called setSelectedTaskId(null) after
      // 300ms, which re-triggered the useEffect in TaskDrawerInfoTab with
      // selectedTaskId = null — wiping all local state (subTasks, attachments,
      // comments) and making taskFormViewModel empty by the time the drawer
      // reopened, causing all fields to render blank.
      // The actual Redux cleanup now lives entirely in afterOpenChange below.
      dispatch(setShowTaskDrawer(false));
    } else {
      handleBackToParent();
    }

    setTimeout(() => {
      isClosingManually.current = false;
    }, 100);
  };

  // FIX: afterOpenChange fires only after the Ant Design close animation
  // fully completes and the drawer is invisible. This is the only safe place
  // to wipe Redux state — no child component can re-render visibly at this
  // point, so there's no flash of empty/null values for the user to see.
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
    dispatch(
      setTimeLogEditing({
        isEditing: false,
        logBeingEdited: null,
      })
    );
  };

  const handleAddTimeLog = () => {
    dispatch(
      setTimeLogEditing({
        isEditing: true,
        logBeingEdited: null,
      })
    );
  };

  const refreshTimeLogs = () => {
    setRefreshTimeLogTrigger(prev => prev + 1);
  };

  const handleTimeLogSubmitSuccess = () => {
    handleCancelTimeLog();
    refreshTimeLogs();
  };

  const handlePremiumTabClick = () => {
    dispatch(toggleUpgradeModal());
  };

  const tabItems: TabsProps['items'] = [
    {
      key: 'info',
      label: t('taskInfoTab.title', { defaultValue: 'Task Info' }),
      children: <TaskDrawerInfoTab t={t} />,
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
    if (activeTab === 'info') {
      return <InfoTabFooter />;
    } else if (activeTab === 'timeLog') {
      if (timeLogEditing.isEditing) {
        return (
          <TimeLogForm
            onCancel={handleCancelTimeLog}
            onSubmitSuccess={handleTimeLogSubmitSuccess}
            initialValues={timeLogEditing.logBeingEdited || undefined}
            mode={timeLogEditing.logBeingEdited ? 'edit' : 'create'}
          />
        );
      } else {
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
    }
    return null;
  };

  const getFooterStyle = () => {
    const baseStyle = {
      padding: '0 24px 16px',
      width: '100%',
      height: 'auto',
      boxSizing: 'border-box' as const,
    };
    if (activeTab === 'timeLog') {
      return { ...baseStyle, overflow: 'visible' };
    }
    return { ...baseStyle, overflow: 'hidden' };
  };

  const getBodyStyle = () => {
    const baseStyle = { padding: '24px', overflow: 'auto' };
    if (activeTab === 'timeLog' && timeLogEditing.isEditing) {
      return { ...baseStyle, height: 'calc(100% - 220px)' };
    }
    return { ...baseStyle, height: 'calc(100% - 180px)' };
  };

  const isSubTask =
    taskFormViewModel?.task?.is_sub_task || !!taskFormViewModel?.task?.parent_task_id;

  const getCloseIcon = () => {
    if (isSubTask) return <ArrowLeftOutlined />;
    return <CloseOutlined />;
  };

  const drawerProps = {
    open: showTaskDrawer,
    onClose: handleOnClose,
    maskClosable: false,
    mask: false,
    // FIX: afterOpenChange fires after the close animation completes.
    // This is where we safely wipe Redux task state — see handleAfterOpenChange.
    afterOpenChange: handleAfterOpenChange,
    width: 720,
    style: { justifyContent: 'space-between' },
    // FIX: destroyOnClose: false — when true, Ant Design unmounts all child
    // components the instant onClose fires (before animation ends), causing
    // every field selector to lose its state while still visible on screen.
    destroyOnClose: false,
    title: <TaskDrawerHeader inputRef={taskNameInputRef} t={t} />,
    footer: renderFooter(),
    styles: {
      body: getBodyStyle(),
      footer: getFooterStyle(),
    },
    closeIcon: getCloseIcon(),
  };

  return (
    <Drawer {...drawerProps}>
      {/* FIX: destroyOnHidden removed from Tabs — it unmounts tab panel content
          on tab switch/drawer close, causing the same blank re-render problem
          inside TaskDrawerInfoTab and its child field selectors. */}
      <Tabs type="card" items={tabItems} onChange={handleTabChange} activeKey={activeTab} />
    </Drawer>
  );
};

export default TaskDrawer;
