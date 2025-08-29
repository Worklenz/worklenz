import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { Task } from '@/types/task-management.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import { IBulkAssignRequest } from '@/types/tasks/bulk-action-bar.types';
import {
  deleteTask,
  fetchTasksV3,
  IGroupBy,
  toggleTaskExpansion,
  updateTaskAssignees,
} from '@/features/task-management/task-management.slice';
import { deselectAll, selectTasks } from '@/features/projects/bulkActions/bulkActionSlice';
import { setConvertToSubtaskDrawerOpen } from '@/features/tasks/tasks.slice';
import { useTranslation } from 'react-i18next';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_project_task_list_context_menu_archive,
  evt_project_task_list_context_menu_assign_me,
  evt_project_task_list_context_menu_delete,
} from '@/shared/worklenz-analytics-events';
import {
  DeleteOutlined,
  DoubleRightOutlined,
  InboxOutlined,
  RetweetOutlined,
  UserAddOutlined,
  LoadingOutlined,
  CopyOutlined,
  message,
} from '@/shared/antd-imports';

interface TaskContextMenuProps {
  task: Task;
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
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { groups: taskGroups } = useAppSelector(state => state.taskManagement);
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const currentGrouping = useAppSelector(state => state.grouping.currentGrouping);
  const archived = useAppSelector(state => state.taskReducer.archived);

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
    if (!projectId || !task.id || !currentSession?.team_member_id) return;

    try {
      setUpdatingAssignToMe(true);

      // Immediate UI update - add current user to assignees
      const currentUser = {
        id: currentSession.team_member_id,
        name: currentSession.name || '',
        email: currentSession.email || '',
        avatar_url: currentSession.avatar_url || '',
        team_member_id: currentSession.team_member_id,
      };

      const updatedAssignees = task.assignees || [];
      const updatedAssigneeNames = task.assignee_names || [];

      // Check if current user is already assigned
      const isAlreadyAssigned = updatedAssignees.includes(currentSession.team_member_id);

      if (!isAlreadyAssigned) {
        // Add current user to assignees for immediate UI feedback
        const newAssignees = [...updatedAssignees, currentSession.team_member_id];
        const newAssigneeNames = [...updatedAssigneeNames, currentUser];

        // Update Redux store immediately for instant UI feedback
        dispatch(
          updateTaskAssignees({
            taskId: task.id,
            assigneeIds: newAssignees,
            assigneeNames: newAssigneeNames,
          })
        );
      }

      const body: IBulkAssignRequest = {
        tasks: [task.id],
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_assign_me);
        // Socket event will handle syncing with other users
      }
    } catch (error) {
      logger.error('Error assigning to me:', error);
      // Revert the optimistic update on error
      dispatch(
        updateTaskAssignees({
          taskId: task.id,
          assigneeIds: task.assignees || [],
          assigneeNames: task.assignee_names || [],
        })
      );
    } finally {
      setUpdatingAssignToMe(false);
      onClose();
    }
  }, [
    projectId,
    task.id,
    task.assignees,
    task.assignee_names,
    currentSession,
    dispatch,
    onClose,
    trackMixpanelEvent,
  ]);

  const handleArchive = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      const res = await taskListBulkActionsApiService.archiveTasks(
        {
          tasks: [task.id],
          project_id: projectId,
        },
        false
      );

      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_archive);
        dispatch(deleteTask(task.id));
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
  }, [projectId, task.id, task.parent_task_id, dispatch, socket, onClose, trackMixpanelEvent]);

  const handleDelete = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      const res = await taskListBulkActionsApiService.deleteTasks({ tasks: [task.id] }, projectId);

      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_delete);
        dispatch(deleteTask(task.id));
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
  }, [projectId, task.id, task.parent_task_id, dispatch, socket, onClose, trackMixpanelEvent]);

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
      options = statusList
        .filter(status => status.id)
        .map(status => ({
          key: status.id!,
          label: (
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: status.color_code }}
              ></span>
              <span>{status.name}</span>
            </div>
          ),
          onClick: () => handleStatusMoveTo(status.id!),
        }));
    } else if (currentGrouping === IGroupBy.PRIORITY) {
      options = priorityList
        .filter(priority => priority.id)
        .map(priority => ({
          key: priority.id!,
          label: (
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: priority.color_code }}
              ></span>
              <span>{priority.name}</span>
            </div>
          ),
          onClick: () => handlePriorityMoveTo(priority.id!),
        }));
    } else if (currentGrouping === IGroupBy.PHASE) {
      options = phaseList
        .filter(phase => phase.id)
        .map(phase => ({
          key: phase.id!,
          label: (
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: phase.color_code }}
              ></span>
              <span>{phase.name}</span>
            </div>
          ),
          onClick: () => handlePhaseMoveTo(phase.id!),
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

  const handleCopyLink = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      const taskLink = `${window.location.origin}/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list&task=${task.id}`;
      await navigator.clipboard.writeText(taskLink);
      message.success(t('contextMenu.linkCopied'));
    } catch (error) {
      logger.error('Error copying link:', error);
      message.error(t('contextMenu.linkCopyFailed'));
    } finally {
      onClose();
    }
  }, [projectId, task.id, onClose, t]);

  const menuItems = useMemo(() => {
    const items = [
      {
        key: 'assignToMe',
        label: (
          <button
            onClick={handleAssignToMe}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
            disabled={updatingAssignToMe}
          >
            {updatingAssignToMe ? (
              <LoadingOutlined className="text-gray-500 dark:text-gray-400" />
            ) : (
              <UserAddOutlined className="text-gray-500 dark:text-gray-400" />
            )}
            <span>{t('contextMenu.assignToMe')}</span>
          </button>
        ),
      },
      {
        key: 'copyLink',
        label: (
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <CopyOutlined className="text-gray-500 dark:text-gray-400" />
            <span>{t('contextMenu.copyLink')}</span>
          </button>
        ),
      },
    ];

    // Add Move To submenu if there are options
    const moveToOptions = getMoveToOptions();
    if (moveToOptions.length > 0) {
      items.push({
        key: 'moveTo',
        label: (
          <div className="relative group">
            <button className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left">
              <div className="flex items-center gap-2">
                <RetweetOutlined className="text-gray-500 dark:text-gray-400" />
                <span>{t('contextMenu.moveTo')}</span>
              </div>
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
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
            <ul className="absolute left-full top-0 mt-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20 hidden group-hover:block">
              {moveToOptions.map(option => (
                <li key={option.key}>
                  <button
                    onClick={option.onClick}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      });
    }

    // Add Archive/Unarchive for parent tasks only
    if (!task?.parent_task_id) {
      items.push({
        key: 'archive',
        label: (
          <button
            onClick={handleArchive}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <InboxOutlined className="text-gray-500 dark:text-gray-400" />
            <span>{archived ? t('contextMenu.unarchive') : t('contextMenu.archive')}</span>
          </button>
        ),
      });
    }

    // Add Convert to Sub Task for parent tasks with no subtasks
    if (task?.sub_tasks_count === 0 && !task?.parent_task_id) {
      items.push({
        key: 'convertToSubTask',
        label: (
          <button
            onClick={() => {
              // Convert task to the format expected by bulkActionSlice
              const projectTask = {
                id: task.id,
                name: task.title || task.name || '',
                task_key: task.task_key,
                status: task.status,
                status_id: task.status,
                priority: task.priority,
                phase_id: task.phase,
                phase_name: task.phase,
                description: task.description,
                start_date: task.startDate,
                end_date: task.dueDate,
                total_hours: task.timeTracking?.estimated || 0,
                total_minutes: task.timeTracking?.logged || 0,
                progress: task.progress,
                sub_tasks_count: task.sub_tasks_count || 0,
                assignees:
                  task.assignees?.map((assigneeId: string) => ({
                    id: assigneeId,
                    name: '',
                    email: '',
                    avatar_url: '',
                    team_member_id: assigneeId,
                    project_member_id: assigneeId,
                  })) || [],
                labels: task.labels || [],
                manual_progress: false,
                created_at: task.createdAt,
                updated_at: task.updatedAt,
                sort_order: task.order,
              };

              // Select the task in bulk action reducer
              dispatch(selectTasks([projectTask]));

              // Open the drawer
              dispatch(setConvertToSubtaskDrawerOpen(true));
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <DoubleRightOutlined className="text-gray-500 dark:text-gray-400" />
            <span>{t('contextMenu.convertToSubTask')}</span>
          </button>
        ),
      });
    }

    // Add Convert to Task for subtasks
    if (task?.parent_task_id) {
      items.push({
        key: 'convertToTask',
        label: (
          <button
            onClick={handleConvertToTask}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <DoubleRightOutlined className="text-gray-500 dark:text-gray-400" />
            <span>{t('contextMenu.convertToTask')}</span>
          </button>
        ),
      });
    }

    // Add Delete
    items.push({
      key: 'delete',
      label: (
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 w-full text-left"
        >
          <DeleteOutlined className="text-red-500 dark:text-red-400" />
          <span>{t('contextMenu.delete')}</span>
        </button>
      ),
    });

    return items;
  }, [
    task,
    projectId,
    updatingAssignToMe,
    archived,
    handleAssignToMe,
    handleArchive,
    handleDelete,
    handleConvertToTask,
    handleCopyLink,
    getMoveToOptions,
    dispatch,
    t,
  ]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-48"
      style={{
        top: position.y,
        left: position.x,
        zIndex: 9999,
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
