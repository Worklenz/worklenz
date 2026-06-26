import {
  Button,
  Dropdown,
  Flex,
  message,
} from '@/shared/antd-imports';
import { useEffect, useRef, useState } from 'react';
import {
  EllipsisOutlined,
  CopyOutlined,
  DeleteOutlined,
} from '@/shared/antd-imports';
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
import {
  deleteTask as deleteTaskFromManagement,
} from '@/features/task-management/task-management.slice';
import { deselectTask } from '@/features/task-management/selection.slice';
import { deleteBoardTask } from '@/features/board/board-slice';
import {
  deleteTask as deleteKanbanTask,
  updateEnhancedKanbanSubtask,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { ITaskViewModel } from '@/types/tasks/task.types';
import TaskDrawerNavigation from '../task-drawer-navigation/task-drawer-navigation';
import logger from '@/utils/errorLogger';

type TaskDrawerHeaderProps = {
  t: TFunction;
  canCreateTask?: boolean;
};

const TaskDrawerHeader = ({ t, canCreateTask }: TaskDrawerHeaderProps) => {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const { clearTaskFromUrl } = useTaskDrawerUrlSync();
  const isDeleting = useRef(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const {
    taskFormViewModel,
    selectedTaskId,
    navigationContext,
  } = useAppSelector(state => state.taskDrawerReducer);

  const currentSession = useAuthService().getCurrentSession();

  const isSubTask =
    taskFormViewModel?.task?.is_sub_task ||
    !!taskFormViewModel?.task?.parent_task_id;

  useEffect(() => {
    if (selectedTaskId && navigationContext) {
      dispatch(syncNavigationIndex());
    }
  }, [selectedTaskId, dispatch, navigationContext]);

  const handleCopyTaskLink = async () => {
    if (!selectedTaskId || !taskFormViewModel?.task?.project_id) return;

    try {
      const taskLink = `${window.location.origin}/worklenz/projects/${taskFormViewModel.task.project_id}?tab=tasks-list&pinned_tab=tasks-list&task=${selectedTaskId}`;

      await navigator.clipboard.writeText(taskLink);

      message.success(
        t('Link copied to clipboard') ||
          'Task link copied to clipboard'
      );
    } catch (error) {
      logger.error('Error copying task link:', error);

      message.error(
        t('Failed to copy task link') ||
          'Failed to copy task link'
      );
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskId) return;

    isDeleting.current = true;
    setDropdownOpen(false);
    setShowDeleteConfirm(false);

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
              parent_task_id:
                taskFormViewModel?.task?.parent_task_id || '',
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

  const renderPopup = () => {
    return (
      <div
        style={{
          background: 'var(--ant-color-bg-elevated)',
          borderRadius: 'var(--ant-border-radius-lg)',
          boxShadow: 'var(--ant-box-shadow-secondary)',
          padding: '4px 0',
          minWidth: '200px',
        }}
      >
        {/* Copy link item */}
        <div
          className="task-drawer-dropdown-item task-drawer-dropdown-item--default"
          onClick={() => {
            handleCopyTaskLink();
            setDropdownOpen(false);
          }}
        >
          <CopyOutlined />
          {t('Copy link to task') || 'Copy link to task'}
        </div>

        {/* Delete Task item */}
        {canCreateTask && (
          <div
            className="task-drawer-dropdown-item task-drawer-dropdown-item--danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <DeleteOutlined />
            {t('taskHeader.deleteTask') || 'Delete Task'}
          </div>
        )}

        {/* Confirmation */}
        {canCreateTask && showDeleteConfirm && (
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--ant-color-split)',
            }}
          >
            <p
              style={{
                margin: '0 0 8px 0',
                fontSize: '12px',
                color: 'var(--ant-color-text-secondary)',
              }}
            >
              {t('taskHeader.deleteTaskConfirmMessage', {
                defaultValue: 'Are you sure?',
              })}
            </p>

            <Flex gap={8}>
              <Button
                size="small"
                danger
                type="primary"
                className="task-delete-confirm-btn"
                style={{ flex: 1 }}
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteTask();
                }}
              >
                {t('taskHeader.deleteConfirmOk', {
                  defaultValue: 'Yes',
                })}
              </Button>

              <Button
                size="small"
                style={{ flex: 1 }}
                onClick={e => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
              >
                {t('taskHeader.deleteConfirmCancel', {
                  defaultValue: 'No',
                })}
              </Button>
            </Flex>
          </div>
        )}
      </div>
    );
  };

  const handlePrevious = () => {
    if (!navigationContext) return;

    dispatch(navigateToPreviousTask());

    const prevTaskId =
      navigationContext.taskIds[
        navigationContext.currentIndex - 1
      ];

    if (prevTaskId && navigationContext.projectId) {
      dispatch(
        fetchTask({
          taskId: prevTaskId,
          projectId: navigationContext.projectId,
        })
      );
    }
  };

  const handleNext = () => {
    if (!navigationContext) return;

    dispatch(navigateToNextTask());

    const nextTaskId =
      navigationContext.taskIds[
        navigationContext.currentIndex + 1
      ];

    if (nextTaskId && navigationContext.projectId) {
      dispatch(
        fetchTask({
          taskId: nextTaskId,
          projectId: navigationContext.projectId,
        })
      );
    }
  };

  return (
    <Flex
      align="center"
      justify="space-between"
      style={{ width: '100%' }}
    >
      <div />

      <Flex gap={6} align="center">
        {!isSubTask &&
          navigationContext &&
          navigationContext.taskIds.length > 1 && (
            <TaskDrawerNavigation
              onPrevious={handlePrevious}
              onNext={handleNext}
              hasPrevious={navigationContext.currentIndex > 0}
              hasNext={
                navigationContext.currentIndex <
                navigationContext.taskIds.length - 1
              }
              currentIndex={navigationContext.currentIndex}
              totalTasks={navigationContext.taskIds.length}
            />
          )}

        <TaskDrawerStatusDropdown
          statuses={taskFormViewModel?.statuses ?? []}
          task={
            taskFormViewModel?.task ??
            ({} as ITaskViewModel)
          }
          teamId={currentSession?.team_id ?? ''}
        />

        <Dropdown
          overlayClassName={'task-drawer-actions-dropdown'}
          placement="bottomRight"
          trigger={['click']}
          open={dropdownOpen}
          onOpenChange={open => {
            setDropdownOpen(open);

            if (!open) {
              setShowDeleteConfirm(false);
            }
          }}
          popupRender={renderPopup}
        >
          <Button
            type="text"
            icon={
              <EllipsisOutlined style={{ fontSize: '24px' }} />
            }
          />
        </Dropdown>
      </Flex>
    </Flex>
  );
};

export default TaskDrawerHeader;