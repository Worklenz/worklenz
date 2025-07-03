import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import { IBulkAssignRequest } from '@/types/tasks/bulk-action-bar.types';
import {
  deleteTask,
  fetchTaskAssignees,
  fetchTasksV3,
  IGroupBy,
  toggleTaskExpansion,
} from '@/features/task-management/task-management.slice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import { setConvertToSubtaskDrawerOpen } from '@/features/task-drawer/task-drawer.slice';
import { useTranslation } from 'react-i18next';
import {
  DeleteOutlined,
  DoubleRightOutlined,
  InboxOutlined,
  RetweetOutlined,
  UserAddOutlined,
} from '@/shared/antd-imports';

interface TaskContextMenuProps {
  task: IProjectTask;
  projectId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  task,
  projectId,
  position,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-management');
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();

  const { groups: taskGroups } = useAppSelector(state => state.taskManagement);
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const currentGrouping = useAppSelector(state => state.grouping.currentGrouping);

  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleAssignToMe = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      setUpdatingAssignToMe(true);
      const body: IBulkAssignRequest = {
        tasks: [task.id],
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        // No need to manually update assignees here, socket event will handle it
        // dispatch(fetchTasksV3(projectId)); // Re-fetch tasks to update UI
      }
    } catch (error) {
      logger.error('Error assigning to me:', error);
    } finally {
      setUpdatingAssignToMe(false);
      onClose();
    }
  }, [projectId, task.id, onClose]);

  const handleArchive = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      const res = await taskListBulkActionsApiService.archiveTasks(
        {
          tasks: [task.id],
          project_id: projectId,
        },
        task.archived || false
      );

      if (res.done) {
        dispatch(deleteTask({ taskId: task.id }));
        dispatch(deselectAll());
        if (task.parent_task_id) {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
        }
      }
    } catch (error) {
      logger.error('Error archiving task:', error);
    } finally {
      onClose();
    }
  }, [projectId, task.id, task.parent_task_id, task.archived, dispatch, socket, onClose]);

  const handleDelete = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      const res = await taskListBulkActionsApiService.deleteTasks({ tasks: [task.id] }, projectId);

      if (res.done) {
        dispatch(deleteTask({ taskId: task.id }));
        dispatch(deselectAll());
        if (task.parent_task_id) {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
        }
      }
    } catch (error) {
      logger.error('Error deleting task:', error);
    } finally {
      onClose();
    }
  }, [projectId, task.id, task.parent_task_id, dispatch, socket, onClose]);

  const handleStatusMoveTo = useCallback(
    async (targetId: string) => {
      if (!projectId || !task.id || !targetId) return;

      try {
        socket?.emit(
          SocketEvents.TASK_STATUS_CHANGE.toString(),
          JSON.stringify({
            task_id: task.id,
            status_id: targetId,
            parent_task: task.parent_task_id || null,
            team_id: currentSession?.team_id,
          })
        );
      } catch (error) {
        logger.error('Error moving status:', error);
      } finally {
        onClose();
      }
    },
    [projectId, task.id, task.parent_task_id, currentSession?.team_id, socket, onClose]
  );

  const handlePriorityMoveTo = useCallback(
    async (targetId: string) => {
      if (!projectId || !task.id || !targetId) return;

      try {
        socket?.emit(
          SocketEvents.TASK_PRIORITY_CHANGE.toString(),
          JSON.stringify({
            task_id: task.id,
            priority_id: targetId,
            parent_task: task.parent_task_id || null,
            team_id: currentSession?.team_id,
          })
        );
      } catch (error) {
        logger.error('Error moving priority:', error);
      } finally {
        onClose();
      }
    },
    [projectId, task.id, task.parent_task_id, currentSession?.team_id, socket, onClose]
  );

  const handlePhaseMoveTo = useCallback(
    async (targetId: string) => {
      if (!projectId || !task.id || !targetId) return;

      try {
        socket?.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
          task_id: task.id,
          phase_id: targetId,
          parent_task: task.parent_task_id || null,
          team_id: currentSession?.team_id,
        });
      } catch (error) {
        logger.error('Error moving phase:', error);
      } finally {
        onClose();
      }
    },
    [projectId, task.id, task.parent_task_id, currentSession?.team_id, socket, onClose]
  );

  const getMoveToOptions = useCallback(() => {
    let options: { key: string; label: React.ReactNode; onClick: () => void }[] = [];

    if (currentGrouping === IGroupBy.STATUS) {
      options = statusList.map(status => ({
        key: status.id,
        label: (
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: status.color_code }}
            ></span>
            <span>{status.name}</span>
          </div>
        ),
        onClick: () => handleStatusMoveTo(status.id),
      }));
    } else if (currentGrouping === IGroupBy.PRIORITY) {
      options = priorityList.map(priority => ({
        key: priority.id,
        label: (
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: priority.color_code }}
            ></span>
            <span>{priority.name}</span>
          </div>
        ),
        onClick: () => handlePriorityMoveTo(priority.id),
      }));
    } else if (currentGrouping === IGroupBy.PHASE) {
      options = phaseList.map(phase => ({
        key: phase.id,
        label: (
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: phase.color_code }}
            ></span>
            <span>{phase.name}</span>
          </div>
        ),
        onClick: () => handlePhaseMoveTo(phase.id),
      }));
    }
    return options;
  }, [
    currentGrouping,
    statusList,
    priorityList,
    phaseList,
    handleStatusMoveTo,
    handlePriorityMoveTo,
    handlePhaseMoveTo,
  ]);

  const handleConvertToTask = useCallback(async () => {
    if (!task?.id || !projectId) return;

    try {
      const res = await tasksApiService.convertToTask(task.id as string, projectId as string);
      if (res.done) {
        dispatch(deselectAll());
        dispatch(fetchTasksV3(projectId));
      }
    } catch (error) {
      logger.error('Error converting to task', error);
    } finally {
      onClose();
    }
  }, [task?.id, projectId, dispatch, onClose]);

  const menuItems = useMemo(() => {
    const items = [
      {
        key: 'assignToMe',
        label: (
          <button
            onClick={handleAssignToMe}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
            disabled={updatingAssignToMe}
          >
            {updatingAssignToMe ? (
              <svg
                className="animate-spin h-4 w-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <UserAddOutlined className="text-gray-500" />
            )}
            <span>{t('contextMenu.assignToMe')}</span>
          </button>
        ),
      },
      {
        key: 'moveTo',
        label: (
          <div className="relative">
            <button className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
              <div className="flex items-center gap-2">
                <RetweetOutlined className="text-gray-500" />
                <span>{t('contextMenu.moveTo')}</span>
              </div>
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                ></path>
              </svg>
            </button>
            <ul className="absolute left-full top-0 mt-0 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 hidden group-hover:block">
              {getMoveToOptions().map(option => (
                <li key={option.key}>
                  <button
                    onClick={option.onClick}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      },
    ];

    if (!task?.parent_task_id) {
      items.push({
        key: 'archive',
        label: (
          <button
            onClick={handleArchive}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
          >
            <InboxOutlined className="text-gray-500" />
            <span>{task.archived ? t('contextMenu.unarchive') : t('contextMenu.archive')}</span>
          </button>
        ),
      });
    }

    if (task?.sub_tasks_count === 0 && !task?.parent_task_id) {
      items.push({
        key: 'convertToSubTask',
        label: (
          <button
            onClick={() => dispatch(setConvertToSubtaskDrawerOpen(true))}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
          >
            <DoubleRightOutlined className="text-gray-500" />
            <span>{t('contextMenu.convertToSubTask')}</span>
          </button>
        ),
      });
    }

    if (task?.parent_task_id) {
      items.push({
        key: 'convertToTask',
        label: (
          <button
            onClick={handleConvertToTask}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
          >
            <DoubleRightOutlined className="text-gray-500" />
            <span>{t('contextMenu.convertToTask')}</span>
          </button>
        ),
      });
    }

    items.push({
      key: 'delete',
      label: (
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-100 w-full text-left"
        >
          <DeleteOutlined className="text-red-500" />
          <span>{t('contextMenu.delete')}</span>
        </button>
      ),
    });

    return items;
  }, [
    task,
    projectId,
    updatingAssignToMe,
    handleAssignToMe,
    handleArchive,
    handleDelete,
    handleConvertToTask,
    getMoveToOptions,
    dispatch,
    t,
  ]);

  return (
    <div
      ref={menuRef}
      className="absolute bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1"
      style={{
        top: position.y,
        left: position.x,
      }}
    >
      <ul className="list-none p-0 m-0">
        {menuItems.map(item => (
          <li key={item.key} className="relative group">
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskContextMenu;
