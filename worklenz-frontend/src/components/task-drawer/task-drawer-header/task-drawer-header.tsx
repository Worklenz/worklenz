import { Button, Dropdown, Flex, Input, InputRef, MenuProps, Skeleton, message } from '@/shared/antd-imports';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { EllipsisOutlined, CopyOutlined, DeleteOutlined  } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

import './task-drawer-header.css';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import TaskDrawerStatusDropdown from '../task-drawer-status-dropdown/task-drawer-status-dropdown';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  navigateToNextTask,
  navigateToPreviousTask,
  fetchTask,
  syncNavigationIndex,
} from '@/features/task-drawer/task-drawer.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import useTaskDrawerUrlSync from '@/hooks/useTaskDrawerUrlSync';
import { deleteTask } from '@/features/tasks/tasks.slice';
import { deleteTask as deleteTaskFromManagement } from '@/features/task-management/task-management.slice';
import { deselectTask } from '@/features/task-management/selection.slice';
import { deleteBoardTask } from '@/features/board/board-slice';
import {
  deleteTask as deleteKanbanTask,
  updateEnhancedKanbanSubtask,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { ITaskViewModel } from '@/types/tasks/task.types';
import TaskHierarchyBreadcrumb from '../task-hierarchy-breadcrumb/task-hierarchy-breadcrumb';
import TaskDrawerNavigation from '../task-drawer-navigation/task-drawer-navigation';
import logger from '@/utils/errorLogger';

type TaskDrawerHeaderProps = {
  inputRef: React.RefObject<InputRef | null>;
  t: TFunction;
};

const TaskDrawerHeader = ({ inputRef, t }: TaskDrawerHeaderProps) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { clearTaskFromUrl } = useTaskDrawerUrlSync();
  const isDeleting = useRef(false);
  const [isEditing, setIsEditing] = useState(false);

  const { taskFormViewModel, selectedTaskId, navigationContext, loadingTask } = useAppSelector(
    state => state.taskDrawerReducer
  );
  const [taskName, setTaskName] = useState<string>(taskFormViewModel?.task?.name ?? '');
  const currentSession = useAuthService().getCurrentSession();

  // Sync navigation index when selected task changes
  useEffect(() => {
    if (selectedTaskId && navigationContext) {
      dispatch(syncNavigationIndex());
    }
  }, [selectedTaskId, dispatch, navigationContext]);

  // Check if current task is a sub-task
  const isSubTask =
    taskFormViewModel?.task?.is_sub_task || !!taskFormViewModel?.task?.parent_task_id;

  useEffect(() => {
    setTaskName(taskFormViewModel?.task?.name ?? '');
  }, [taskFormViewModel?.task?.name]);

  const onTaskNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTaskName(e.currentTarget.value);
  };

  const handleCopyTaskLink = async () => {
    if (!selectedTaskId || !taskFormViewModel?.task?.project_id) return;

    try {
      const taskLink = `${window.location.origin}/worklenz/projects/${taskFormViewModel.task.project_id}?tab=tasks-list&pinned_tab=tasks-list&task=${selectedTaskId}`;
      await navigator.clipboard.writeText(taskLink);
      message.success(t('Link copied to clipboard') || 'Task link copied to clipboard');
    } catch (error) {
      logger.error('Error copying task link:', error);
      message.error(t('Failed to copy task link') || 'Failed to copy task link');
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskId) return;

    // Set flag to indicate we're deleting the task
    isDeleting.current = true;

    const res = await tasksApiService.deleteTask(selectedTaskId);
    if (res.done) {
      // Update all relevant slices to ensure task is removed everywhere
      dispatch(deleteTask({ taskId: selectedTaskId })); // Old tasks slice
      dispatch(deleteTaskFromManagement(selectedTaskId)); // Task management slice (TaskListV2)
      dispatch(deselectTask(selectedTaskId)); // Remove from selection if selected
      dispatch(deleteBoardTask({ sectionId: '', taskId: selectedTaskId })); // Board slice

      // Clear the task drawer state and URL
      dispatch(setSelectedTaskId(null));
      dispatch(deleteTask({ taskId: selectedTaskId }));
      dispatch(deleteBoardTask({ sectionId: '', taskId: selectedTaskId }));
      if (taskFormViewModel?.task?.is_sub_task) {
        dispatch(
          updateEnhancedKanbanSubtask({
            sectionId: '',
            subtask: {
              id: selectedTaskId,
              parent_task_id: taskFormViewModel?.task?.parent_task_id || '',
              manual_progress: false,
            },
            mode: 'delete',
          })
        );
      } else {
        dispatch(deleteKanbanTask(selectedTaskId));
      }
      dispatch(setShowTaskDrawer(false));
      // Reset the flag after a short delay
      setTimeout(() => {
        clearTaskFromUrl();
        isDeleting.current = false;
      }, 100);
      if (taskFormViewModel?.task?.parent_task_id) {
        socket?.emit(
          SocketEvents.GET_TASK_PROGRESS.toString(),
          taskFormViewModel?.task?.parent_task_id
        );
      }
    } else {
      isDeleting.current = false;
    }
  };

  // Menu click handler
  const handleMenuClick: MenuProps['onClick'] = (e) => {
    if (e.key === 'copy-link') {
      handleCopyTaskLink();
    } else if (e.key === 'delete') {
      handleDeleteTask();
    }
  };

  // Dropdown menu items
  const taskDrawerDropdownItems: MenuProps['items'] = [
    {
      key: 'copy-link',
      label: t('Copy link to task') || 'Copy link to task',
      icon: <CopyOutlined />,
    },
    {
      key: 'delete',
      label: t('taskHeader.deleteTask'),
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  const menuProps = {
    items: taskDrawerDropdownItems,
    onClick: handleMenuClick,
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    if (
      !selectedTaskId ||
      !connected ||
      taskName === taskFormViewModel?.task?.name ||
      taskName === undefined ||
      taskName === null ||
      taskName === ''
    )
      return;
    socket?.emit(
      SocketEvents.TASK_NAME_CHANGE.toString(),
      JSON.stringify({
        task_id: selectedTaskId,
        name: taskName,
        parent_task: taskFormViewModel?.task?.parent_task_id,
      })
    );
    // Note: Real-time updates are handled by the global useTaskSocketHandlers hook
    // No need for local socket listeners that could interfere with global handlers
  };

  const handlePrevious = () => {
    if (!navigationContext) return;
    dispatch(navigateToPreviousTask());
    // Fetch the previous task
    const prevTaskId = navigationContext.taskIds[navigationContext.currentIndex - 1];
    if (prevTaskId && navigationContext.projectId) {
      dispatch(fetchTask({ taskId: prevTaskId, projectId: navigationContext.projectId }));
    }
  };

  const handleNext = () => {
    if (!navigationContext) return;
    dispatch(navigateToNextTask());
    // Fetch the next task
    const nextTaskId = navigationContext.taskIds[navigationContext.currentIndex + 1];
    if (nextTaskId && navigationContext.projectId) {
      dispatch(fetchTask({ taskId: nextTaskId, projectId: navigationContext.projectId }));
    }
  };

  // Show loading skeleton if task is loading OR if we don't have task name yet
  const isLoadingTaskName = loadingTask || !taskFormViewModel?.task?.name;

  return (
    <div>
      {/* Show breadcrumb for sub-tasks */}
      {isSubTask && <TaskHierarchyBreadcrumb t={t} />}

      <Flex gap={8} align="center" style={{ marginBlockEnd: 2 }}>
        <Flex style={{ position: 'relative', width: '100%', alignItems: 'center' }}>
          {isLoadingTaskName ? (
            <Skeleton.Input active size="large" style={{ width: '100%' }} />
          ) : isEditing ? (
            <Input
              ref={inputRef}
              size="large"
              value={taskName}
              onChange={e => onTaskNameChange(e)}
              onBlur={handleInputBlur}
              placeholder={t('taskHeader.taskNamePlaceholder')}
              className="task-name-input"
              style={{
                width: '100%',
                border: 'none',
              }}
              showCount={true}
              maxLength={250}
              autoFocus
            />
          ) : (
            <p onClick={() => setIsEditing(true)} className="task-name-display">
              {taskName}
            </p>
          )}
        </Flex>
        
        {/* Task Navigation - Show only if navigation context exists */}
        {!isSubTask && navigationContext && navigationContext.taskIds.length > 1 && (
          <TaskDrawerNavigation
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={navigationContext.currentIndex > 0}
            hasNext={navigationContext.currentIndex < navigationContext.taskIds.length - 1}
            currentIndex={navigationContext.currentIndex}
            totalTasks={navigationContext.taskIds.length}
          />
        )}

        <TaskDrawerStatusDropdown
          statuses={taskFormViewModel?.statuses ?? []}
          task={taskFormViewModel?.task ?? ({} as ITaskViewModel)}
          teamId={currentSession?.team_id ?? ''}
        />

        <Dropdown
          overlayClassName={'task-drawer-actions-dropdown'}
          menu={menuProps}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button type="text" icon={<EllipsisOutlined />} />
        </Dropdown>
      </Flex>
    </div>
  );
};

export default TaskDrawerHeader;