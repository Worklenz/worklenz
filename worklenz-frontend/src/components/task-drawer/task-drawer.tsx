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
import InfoTabFooter from './shared/info-tab/info-tab-footer';
import { Flex } from '@/shared/antd-imports';

const TaskDrawer = () => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const [activeTab, setActiveTab] = useState<string>('info');
  const [refreshTimeLogTrigger, setRefreshTimeLogTrigger] = useState(0);

  const { showTaskDrawer, timeLogEditing } = useAppSelector(state => state.taskDrawerReducer);
  const { taskFormViewModel, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const taskNameInputRef = useRef<InputRef>(null);
  const isClosingManually = useRef(false);

  // Use the custom hook to sync the task drawer state with the URL
  const { clearTaskFromUrl } = useTaskDrawerUrlSync();

  useEffect(() => {
    if (taskNameInputRef.current?.input?.value === DEFAULT_TASK_NAME) {
      taskNameInputRef.current.focus();
    }
  }, [showTaskDrawer]);

  const dispatch = useAppDispatch();

  const resetTaskState = () => {
    dispatch(setShowTaskDrawer(false));
    dispatch(setSelectedTaskId(null));
    dispatch(setTaskFormViewModel({}));
    dispatch(setTaskSubscribers([]));
  };

  const handleBackToParent = () => {
    if (taskFormViewModel?.task?.parent_task_id && projectId) {
      // Navigate to parent task
      dispatch(setSelectedTaskId(taskFormViewModel.task.parent_task_id));
      dispatch(fetchTask({ 
        taskId: taskFormViewModel.task.parent_task_id, 
        projectId 
      }));
    }
  };

  const handleOnClose = (
    e?: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element>
  ) => {
    // Set flag to indicate we're manually closing the drawer
    isClosingManually.current = true;
    setActiveTab('info');
    clearTaskFromUrl();

    const isClickOutsideDrawer =
      e?.target && (e.target as HTMLElement).classList.contains('ant-drawer-mask');

    if (isClickOutsideDrawer || !taskFormViewModel?.task?.is_sub_task) {
      resetTaskState();
    } else {
      // For sub-tasks, navigate to parent instead of closing
      handleBackToParent();
    }
    // Reset the flag after a short delay
    setTimeout(() => {
      isClosingManually.current = false;
    }, 100);
  };

  const handleTabChange = (key: string) => {
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

  // Function to trigger a refresh of the time log list
  const refreshTimeLogs = () => {
    setRefreshTimeLogTrigger(prev => prev + 1);
  };

  const handleTimeLogSubmitSuccess = () => {
    // Close the form
    handleCancelTimeLog();
    // Trigger refresh of time logs
    refreshTimeLogs();
  };

  const tabItems: TabsProps['items'] = [
    {
      key: 'info',
      label: t('taskInfoTab.title'),
      children: <TaskDrawerInfoTab t={t} />,
    },
    {
      key: 'timeLog',
      label: t('taskTimeLogTab.title'),
      children: <TaskDrawerTimeLog t={t} refreshTrigger={refreshTimeLogTrigger} />,
    },
    {
      key: 'activityLog',
      label: t('taskActivityLogTab.title'),
      children: <TaskDrawerActivityLog />,
    },
  ];

  // Render the appropriate footer based on the active tab
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
              {t('taskTimeLogTab.addTimeLog')}
            </Button>
          </Flex>
        );
      }
    }
    return null;
  };

  // Create conditional footer styles based on active tab
  const getFooterStyle = () => {
    const baseStyle = {
      padding: '0 24px 16px',
      width: '100%',
      height: 'auto',
      boxSizing: 'border-box' as const,
    };

    if (activeTab === 'timeLog') {
      return {
        ...baseStyle,
        overflow: 'visible', // Remove scrolling for timeLog tab
      };
    }

    return {
      ...baseStyle,
      overflow: 'hidden',
    };
  };

  // Get conditional body style
  const getBodyStyle = () => {
    const baseStyle = {
      padding: '24px',
      overflow: 'auto',
    };

    if (activeTab === 'timeLog' && timeLogEditing.isEditing) {
      return {
        ...baseStyle,
        height: 'calc(100% - 220px)', // More space for the timeLog form
      };
    }

    return {
      ...baseStyle,
      height: 'calc(100% - 180px)',
    };
  };

  // Check if current task is a sub-task
  const isSubTask = taskFormViewModel?.task?.is_sub_task || !!taskFormViewModel?.task?.parent_task_id;

  // Custom close icon based on whether it's a sub-task
  const getCloseIcon = () => {
    if (isSubTask) {
      return <ArrowLeftOutlined />;
    }
    return <CloseOutlined />;
  };

  const drawerProps = {
    open: showTaskDrawer,
    onClose: handleOnClose,
    width: 720,
    style: { justifyContent: 'space-between' },
    destroyOnClose: true,
    title: <TaskDrawerHeader inputRef={taskNameInputRef} t={t} />,
    footer: renderFooter(),
    bodyStyle: getBodyStyle(),
    footerStyle: getFooterStyle(),
    closeIcon: getCloseIcon(),
  };

  return (
    <Drawer {...drawerProps}>
      <Tabs
        type="card"
        items={tabItems}
        destroyOnHidden
        onChange={handleTabChange}
        activeKey={activeTab}
      />
    </Drawer>
  );
};

export default TaskDrawer;
