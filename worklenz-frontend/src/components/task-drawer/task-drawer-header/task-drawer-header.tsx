import {
  Button,
  Dropdown,
  Flex,
  Input,
  InputRef,
  MenuProps,
  Skeleton,
  message,
  Typography,
} from '@/shared/antd-imports';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { EllipsisOutlined, CopyOutlined, DeleteOutlined } from '@/shared/antd-imports';
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
  updateSelectedTaskName,
} from '@/features/task-drawer/task-drawer.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import useTaskDrawerUrlSync from '@/hooks/useTaskDrawerUrlSync';
import { deleteTask } from '@/features/tasks/tasks.slice';
import {
  deleteTask as deleteTaskFromManagement,
  updateTask,
} from '@/features/task-management/task-management.slice';
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
import { store } from '@/app/store';
import { Task } from '@/types/task-management.types';

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
  const projectName = useAppSelector(state => state.projectReducer.project?.name ?? null);
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

  // Only sync from Redux when NOT actively editing, to avoid overwriting what the user is typing
  useEffect(() => {
    if (!isEditing) {
      setTaskName(taskFormViewModel?.task?.name ?? '');
    }
  }, [taskFormViewModel?.task?.name, isEditing]);

  const onTaskNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newName = e.currentTarget.value;
    setTaskName(newName);

    if (selectedTaskId) {
      dispatch(updateSelectedTaskName({ id: selectedTaskId, name: newName }));

      const currentTask = store.getState().taskManagement.entities[selectedTaskId];
      if (currentTask) {
        dispatch(
          updateTask({
            ...currentTask,
            title: newName,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Task)
        );
      }
    }
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

    isDeleting.current = true;

    const res = await tasksApiService.deleteTask(selectedTaskId);
    if (res.done) {
      dispatch(deleteTask({ taskId: selectedTaskId }));
      dispatch(deleteTaskFromManagement(selectedTaskId));
      dispatch(deselectTask(selectedTaskId));
      dispatch(deleteBoardTask({ sectionId: '', taskId: selectedTaskId }));

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

  const handleMenuClick: MenuProps['onClick'] = e => {
    if (e.key === 'copy-link') {
      handleCopyTaskLink();
    } else if (e.key === 'delete') {
      handleDeleteTask();
    }
  };

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
  };

  const handlePrevious = () => {
    if (!navigationContext) return;
    dispatch(navigateToPreviousTask());
    const prevTaskId = navigationContext.taskIds[navigationContext.currentIndex - 1];
    if (prevTaskId && navigationContext.projectId) {
      dispatch(fetchTask({ taskId: prevTaskId, projectId: navigationContext.projectId }));
    }
  };

  const handleNext = () => {
    if (!navigationContext) return;
    dispatch(navigateToNextTask());
    const nextTaskId = navigationContext.taskIds[navigationContext.currentIndex + 1];
    if (nextTaskId && navigationContext.projectId) {
      dispatch(fetchTask({ taskId: nextTaskId, projectId: navigationContext.projectId }));
    }
  };

  const isLoadingTaskName = loadingTask && !taskFormViewModel?.task?.name;

  return (
    <div className="task-drawer-header-wrapper">
      {/* Top row: project name / breadcrumb + actions */}
      <Flex align="center" justify="space-between" className="task-drawer-header-top-row">
        {/* Left: project > [parent task >] current context */}
        <div className="task-drawer-breadcrumb-area">
          <TaskHierarchyBreadcrumb t={t} projectName={projectName} />
        </div>

        {/* Right: navigation + status + menu */}
        <Flex gap={6} align="center" style={{ flexShrink: 0 }}>
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
      </Flex>

      {/* Bottom row: large task name */}
      <div className="task-drawer-name-row">
        {isLoadingTaskName ? (
          <Skeleton.Input active size="large" style={{ width: '100%', height: 32 }} />
        ) : isEditing ? (
          <Input
            ref={inputRef}
            value={taskName}
            onChange={e => onTaskNameChange(e)}
            onBlur={handleInputBlur}
            placeholder={t('taskHeader.taskNamePlaceholder')}
            className="task-name-input task-name-input--large"
            style={{ width: '100%', border: 'none', padding: 0 }}
            showCount={true}
            maxLength={250}
            autoFocus
          />
        ) : (
          <Typography.Title
            level={4}
            onClick={() => setIsEditing(true)}
            className="task-name-display task-name-display--large"
            style={{ margin: 0, cursor: 'text', lineHeight: 1.3 }}
          >
            {taskName || t('taskHeader.taskNamePlaceholder')}
          </Typography.Title>
        )}
      </div>
    </div>
  );
};

export default TaskDrawerHeader;