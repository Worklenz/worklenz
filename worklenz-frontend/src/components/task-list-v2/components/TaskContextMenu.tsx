import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import alertService from '@/services/alerts/alertService';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import { Task } from '@/types/task-management.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import { IBulkAssignRequest } from '@/types/tasks/bulk-action-bar.types';
import {
  deleteTask,
  fetchTasksV3,
  IGroupBy,
  setDuplicateTask,
  setDuplicateTaskModalStatus,
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
  CrownOutlined,
  message,
  LinkOutlined,
} from '@/shared/antd-imports';
import DuplicateTaskModal from './DuplicateTaskModal';

interface TaskContextMenuProps {
  task: Task;
  projectId: string;
  position: { x: number; y: number };
  onClose: () => void;
  canCreateTask?: boolean;
}

const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  task,
  projectId,
  position,
  onClose,
  canCreateTask = true,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-table');
  const { t: tCommon } = useTranslation('common');
  const { socket, connected } = useSocket();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const { isFreeUser: isFree } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { groups: taskGroups } = useAppSelector(state => state.taskManagement);
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const currentGrouping = useAppSelector(state => state.grouping.currentGrouping);
  const archived = useAppSelector(state => state.taskManagement.archived);

  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [showMoveToSubmenu, setShowMoveToSubmenu] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const moveToRef = useRef<HTMLDivElement>(null);

  // Calculate optimal position to prevent overflow
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let newX = position.x;
      let newY = position.y;

      // Check if menu goes beyond right edge
      if (position.x + menuRect.width > viewportWidth) {
        newX = viewportWidth - menuRect.width - 10; // 10px margin from edge
      }

      // Check if menu goes beyond bottom edge
      if (position.y + menuRect.height > viewportHeight) {
        // Open above the cursor instead of below
        newY = position.y - menuRect.height;

        // If opening above would go beyond top edge, position at top with margin
        if (newY < 10) {
          newY = 10;
        }
      }

      // Check if menu goes beyond top edge
      if (newY < 10) {
        newY = 10;
      }

      // Ensure menu doesn't go beyond left edge
      if (newX < 10) {
        newX = 10;
      }

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [position]);

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
    // Only show upgrade modal when archiving (not unarchiving) and user is free
    if (isFree && !archived) {
      promptUpgrade();
      onClose();
      return;
    }

    if (!projectId || !task.id) return;

    try {
      // Pass the archived state to the API
      // When archived=true (viewing archived tasks), this will UNARCHIVE
      // When archived=false (viewing normal tasks), this will ARCHIVE
      const res = await taskListBulkActionsApiService.archiveTasks(
        {
          tasks: [task.id],
          project_id: projectId,
        },
        archived // This is the key fix - pass current archived view state
      );

      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_archive);

        // Remove task from current view (whether archived or normal)
        dispatch(
          deleteTask({
            taskId: task.id,
            parentTaskId: task.parent_task_container_id || task.parent_task_id,
          })
        );
        dispatch(deselectAll());

        // Note: We DON'T call fetchTasksV3 here because:
        // - If archiving: task is moved to archived list, not needed in current view
        // - If unarchiving: task is moved to normal list, but we're still viewing archived
        // The task will appear in the correct list when user switches views

        if (task.parent_task_id) {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
        }
      }
    } catch (error) {
      logger.error('Error archiving/unarchiving task:', error);
    } finally {
      onClose();
    }
  }, [projectId, task.id, dispatch, onClose, trackMixpanelEvent, isFree, archived]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
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
  }, [projectId, task.id, dispatch, onClose, trackMixpanelEvent]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleStatusMoveTo = useCallback(
    async (targetId: string) => {
      if (!projectId || !task.id || !targetId) return;

      try {
        // Check dependencies BEFORE emitting the socket event
        if (task.status !== targetId) {
          const canContinue = await checkTaskDependencyStatus(task.id, targetId);
          if (!canContinue) {
            alertService.error(t('errors.taskNotCompleted'), t('errors.completeTaskDependencies'));
            onClose();
            return;
          }
        }

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
    [
      projectId,
      task.id,
      task.status,
      task.parent_task_id,
      currentSession?.team_id,
      socket,
      onClose,
      t,
    ]
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

  const handleDuplicateTask = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      dispatch(setDuplicateTask({ taskId: task.id, title: task.title }));
      dispatch(setDuplicateTaskModalStatus(true));
    } catch (error) {
      logger.error('Error open duplicate task modal:', error);
    } finally {
      onClose();
    }
  }, [projectId, task.id, dispatch, onClose]);

  const menuItems = useMemo(() => {
    const items = [
      ...(canCreateTask
        ? [
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
          ]
        : []),
      {
        key: 'duplicateTask',
        label: (
          <button
            onClick={handleDuplicateTask}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <CopyOutlined className="text-gray-500 dark:text-gray-400" />
            <span>{t('contextMenu.duplicateTask')}</span>
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
            <LinkOutlined className="text-gray-500 dark:text-gray-400" />
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
          <div
            ref={moveToRef}
            className="relative"
            onMouseEnter={() => setShowMoveToSubmenu(true)}
            onMouseLeave={() => setShowMoveToSubmenu(false)}
          >
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
            {showMoveToSubmenu && (
              <ul
                className="fixed w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[10000]"
                style={{
                  left: moveToRef.current
                    ? moveToRef.current.getBoundingClientRect().right
                    : 0,
                  top: moveToRef.current ? moveToRef.current.getBoundingClientRect().top : 0,
                }}
              >
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
            )}
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
            <div className="flex items-center gap-2">
              <InboxOutlined className="text-gray-500 dark:text-gray-400" />
              <span>{archived ? t('contextMenu.unarchive') : t('contextMenu.archive')}</span>
              {isFree && !archived && (
                <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
              )}
            </div>
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
    if (canCreateTask) {
      if (showDeleteConfirm) {
        const isSubtask = !!task.parent_task_id;
        const confirmMessage = isSubtask
          ? t('contextMenu.deleteSubtaskConfirmMessage', {
              defaultValue:
                'Are you sure you want to delete this subtask? This action cannot be undone.',
            })
          : t('contextMenu.deleteConfirmMessage', {
              defaultValue:
                'Are you sure you want to delete this task? This action cannot be undone.',
            });

        items.push({
          key: 'delete-confirm',
          label: (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/10">
              <DeleteOutlined className="text-red-500 dark:text-red-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                {t('contextMenu.deleteConfirmOk', { defaultValue: 'Delete' })}?
              </span>
              <button
                onClick={handleDeleteConfirm}
                className="px-2 py-0.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded"
              >
                Yes
              </button>
              <button
                onClick={handleDeleteCancel}
                className="px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                No
              </button>
            </div>
          ),
        });
      } else {
        items.push({
          key: 'delete',
          label: (
            <button
              onClick={handleDeleteClick}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 w-full text-left"
            >
              <DeleteOutlined className="text-red-500 dark:text-red-400" />
              <span>{t('contextMenu.delete')}</span>
            </button>
          ),
        });
      }
    }

    return items;
  }, [
    task,
    projectId,
    updatingAssignToMe,
    archived,
    isFree,
    showDeleteConfirm,
    canCreateTask,
    handleAssignToMe,
    handleArchive,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleConvertToTask,
    handleCopyLink,
    getMoveToOptions,
    dispatch,
    handleDuplicateTask,
    t,
  ]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-48"
      style={{
        top: adjustedPosition.y,
        left: adjustedPosition.x,
        zIndex: 9999,
        maxHeight: 'calc(100vh - 20px)',
        overflowY: 'auto',
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
