import { useCallback, useEffect } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import alertService from '@/services/alerts/alertService';
import { store } from '@/app/store';
import { handleNewTaskReceived as handleTaskReceivedUtil } from '@/utils/taskHandlers';
import { decodeHtmlEntities } from '@/utils/html-entities';

import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { ILabelsChangeResponse } from '@/types/tasks/taskList.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { ITaskPhaseChangeResponse } from '@/types/tasks/task-phase-change-response';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { Task } from '@/types/task-management.types';

import {
  fetchTaskAssignees,
  updateTaskAssignees,
  fetchLabelsByProject,
  updateTaskLabel,
  updateTaskStatus,
  updateTaskPriority,
  updateTaskEndDate,
  updateTaskEstimation,
  updateTaskName,
  updateTaskPhase,
  updateTaskStartDate,
  updateTaskDescription,
  updateSubTasks,
  updateTaskProgress,
  updateTaskTimeTracking,
} from '@/features/tasks/tasks.slice';
import {
  addTask,
  addTaskToGroup,
  updateTask,
  reorderTasks,
  moveTaskToGroup,
  moveTaskBetweenGroups,
  selectCurrentGroupingV3,
  fetchTasksV3,
  addSubtaskToParent,
  removeTemporarySubtask,
} from '@/features/task-management/task-management.slice';
import {
  updateEnhancedKanbanSubtask,
  addTaskToGroup as addEnhancedKanbanTaskToGroup,
  updateEnhancedKanbanTaskStatus,
  updateEnhancedKanbanTaskPriority,
  updateEnhancedKanbanTaskAssignees,
  updateEnhancedKanbanTaskLabels,
  updateEnhancedKanbanTaskProgress,
  updateEnhancedKanbanTaskName,
  updateEnhancedKanbanTaskEndDate,
  updateEnhancedKanbanTaskStartDate,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { selectCurrentGrouping } from '@/features/task-management/grouping.slice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import {
  setStartDate,
  setTaskAssignee,
  setTaskEndDate,
  setTaskLabels,
  setTaskPriority,
  setTaskStatus,
  setTaskSubscribers,
  updateSelectedTaskName,
  setTaskDescription,
} from '@/features/task-drawer/task-drawer.slice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import { useMixpanelTracking } from './useMixpanelTracking';
import {
  evt_project_task_create,
  evt_project_task_list_create_subtask,
} from '@/shared/worklenz-analytics-events';

export const useTaskSocketHandlers = () => {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { loadingAssignees, taskGroups } = useAppSelector((state: any) => state.taskReducer);
  const { projectId } = useAppSelector((state: any) => state.projectReducer);
  const currentGroupingV3 = useAppSelector(selectCurrentGroupingV3);
  const enhancedKanbanGroupBy = useAppSelector((state: any) => state.enhancedKanbanReducer.groupBy);

  // Memoize socket event handlers
  const handleAssigneesUpdate = useCallback(
    (data: ITaskAssigneesUpdateResponse) => {
      if (!data) return;

      const updatedAssignees =
        data.assignees?.map(assignee => ({
          ...assignee,
          selected: true,
        })) || [];

      // REAL-TIME UPDATES: Update the task-management slice for immediate UI updates
      if (data.id) {
        const currentTask = store.getState().taskManagement.entities[data.id];
        if (currentTask) {
          const updatedTask: Task = {
            ...currentTask,
            assignees: data.assignees?.map(a => a.team_member_id) || [],
            assignee_names: data.names || [],
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));
        }

        // Only update task name if it's actually provided (not undefined)
        if (data.name !== undefined) {
          dispatch(updateSelectedTaskName({ id: data.id, name: decodeHtmlEntities(data.name) }));
        }
      }

      // Update the old task slice (for backward compatibility)
      const groupId = taskGroups?.find((group: ITaskListGroup) =>
        group.tasks?.some(
          (task: IProjectTask) =>
            task.id === data.id ||
            (task.sub_tasks &&
              task.sub_tasks.some((subtask: IProjectTask) => subtask.id === data.id))
        )
      )?.id;

      if (groupId) {
        dispatch(
          updateTaskAssignees({
            groupId,
            taskId: data.id,
            assignees: updatedAssignees,
          })
        );

        dispatch(
          setTaskAssignee({
            ...data,
            manual_progress: false,
          } as IProjectTask)
        );

        // Update enhanced kanban slice
        dispatch(updateEnhancedKanbanTaskAssignees(data));

        // Remove unnecessary refetch - real-time updates handle this
        // if (currentSession?.team_id && !loadingAssignees) {
        //   dispatch(fetchTaskAssignees(currentSession.team_id));
        // }
      }
    },
    [taskGroups, dispatch, currentSession?.team_id, loadingAssignees]
  );

  const handleLabelsChange = useCallback(
    async (labels: ILabelsChangeResponse) => {
      if (!labels) return;

      // REAL-TIME UPDATES: Update the task-management slice for immediate UI updates
      if (labels.id) {
        const currentTask = store.getState().taskManagement.entities[labels.id];
        if (currentTask) {
          const updatedTask: Task = {
            ...currentTask,
            labels:
              labels.labels?.map(l => ({
                id: l.id || '',
                name: l.name || '',
                color: l.color_code || '#1890ff',
                end: l.end,
                names: l.names,
              })) || [],
            all_labels:
              labels.all_labels?.map(l => ({
                id: l.id || '',
                name: l.name || '',
                color_code: l.color_code || '#1890ff',
              })) || [],
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));
        }
      }

      // Update the old task slice and other related slices (for backward compatibility)
      // Only update existing data, don't refetch from server
      await Promise.all([
        dispatch(updateTaskLabel(labels)),
        dispatch(setTaskLabels(labels)),
        labels.is_new && dispatch(fetchLabels()),
        // When a new label is created, update the labels filter dropdown by fetching project labels
        labels.is_new && projectId && dispatch(fetchLabelsByProject(projectId)),
      ]);

      // Update enhanced kanban slice
      dispatch(updateEnhancedKanbanTaskLabels(labels));
    },
    [dispatch, projectId]
  );

  const handleTaskStatusChange = useCallback(
    (response: ITaskListStatusChangeResponse) => {
      if (!response) return;

      if (response.completed_deps === false) {
        alertService.error(
          'Task is not completed',
          'Please complete the task dependencies before proceeding'
        );
        // CRITICAL FIX: Prevent any UI updates when dependencies are not met
        // Refetch tasks to revert any optimistic updates
        if (projectId) {
          dispatch(fetchTasksV3(projectId));
        }
        return;
      }

      // Update the old task slice (for backward compatibility)
      dispatch(updateTaskStatus(response));
      dispatch(deselectAll());

      // Update enhanced kanban slice
      dispatch(updateEnhancedKanbanTaskStatus(response));

      // For the task management slice, update the task entity and handle group movement
      const state = store.getState();
      const groups = state.taskManagement.groups;
      const currentTask = state.taskManagement.entities[response.id];
      const currentGrouping = state.taskManagement.grouping;

      // Determine the new status value based on status category
      let newStatusValue: 'todo' | 'doing' | 'done' = 'todo';
      if (response.statusCategory) {
        if (response.statusCategory.is_done) {
          newStatusValue = 'done';
        } else if (response.statusCategory.is_doing) {
          newStatusValue = 'doing';
        } else {
          newStatusValue = 'todo';
        }
      }

      // Update the task entity (create if it doesn't exist)
      const taskUpdate = currentTask
        ? {
            ...currentTask,
            status: response.status_id || newStatusValue,
            progress:
              typeof response.complete_ratio === 'number'
                ? response.complete_ratio
                : currentTask.progress,
            complete_ratio: response.complete_ratio,
            completedAt: response.completed_at,
            completed_at: response.completed_at,
            updatedAt: new Date().toISOString(),
          }
        : ({
            // If task doesn't exist in Redux, create minimal task object
            id: response.id,
            status: response.status_id || newStatusValue,
            priority: '', // Add required priority field
            progress: typeof response.complete_ratio === 'number' ? response.complete_ratio : 0,
            complete_ratio: response.complete_ratio,
            completedAt: response.completed_at,
            completed_at: response.completed_at,
            updatedAt: new Date().toISOString(),
            created_at: new Date().toISOString(), // Add required created_at field
            updated_at: new Date().toISOString(), // Add required updated_at field
            title: '',
            name: '',
          } as Task);

      dispatch(updateTask(taskUpdate));

      // Handle group movement ONLY if grouping by status and task exists
      if (currentTask && groups && groups.length > 0 && currentGrouping === 'status') {
        // Find current group containing the task
        const currentGroup = groups.find(group => group.taskIds.includes(response.id));

        // Find target group based on the actual status ID from response
        let targetGroup = groups.find(group => group.id === response.status_id);

        // If not found by status ID, try matching with group value
        if (!targetGroup) {
          targetGroup = groups.find(group => group.groupValue === response.status_id);
        }

        // If still not found, try matching by status name (fallback)
        if (!targetGroup && (response as any).status) {
          const statusName = String((response as any).status || '').toLowerCase();
          targetGroup = groups.find(group => group.title?.toLowerCase() === statusName);
        }

        if (currentGroup && targetGroup && currentGroup.id !== targetGroup.id) {
          // Use the action to move task between groups
          dispatch(
            moveTaskBetweenGroups({
              taskId: response.id,
              sourceGroupId: currentGroup.id,
              targetGroupId: targetGroup.id,
            })
          );
        } else if (!targetGroup) {
          // Fallback: refetch tasks to ensure consistency
          if (projectId) {
            dispatch(fetchTasksV3(projectId));
          }
        }
      }
    },
    [dispatch, currentGroupingV3, projectId]
  );

  const handleTaskProgress = useCallback(
    (data: {
      id: string;
      status: string;
      complete_ratio: number;
      completed_count: number;
      total_tasks_count: number;
      parent_task: string;
    }) => {
      if (!data) return;

      // Update the old task slice (for backward compatibility)
      dispatch(
        updateTaskProgress({
          taskId: data.parent_task || data.id,
          progress: data.complete_ratio,
          totalTasksCount: data.total_tasks_count,
          completedCount: data.completed_count,
        })
      );

      // For the task management slice, update task progress
      const taskId = data.parent_task || data.id;
      if (taskId) {
        const currentTask = store.getState().taskManagement.entities[taskId];
        if (currentTask) {
          const updatedTask: Task = {
            ...currentTask,
            progress: data.complete_ratio,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));
        }
      }

      // Update enhanced kanban slice
      dispatch(
        updateEnhancedKanbanTaskProgress({
          id: data.id,
          complete_ratio: data.complete_ratio,
          completed_count: data.completed_count,
          total_tasks_count: data.total_tasks_count,
          parent_task: data.parent_task || '',
        })
      );
    },
    [dispatch]
  );

  const handlePriorityChange = useCallback(
    (response: ITaskListPriorityChangeResponse) => {
      if (!response) return;

      // Update the old task slice (for backward compatibility)
      dispatch(updateTaskPriority(response));
      dispatch(setTaskPriority(response));
      dispatch(deselectAll());

      // Update enhanced kanban slice
      dispatch(updateEnhancedKanbanTaskPriority(response));

      // For the task management slice, update the task entity and handle group movement
      const state = store.getState();
      const currentTask = state.taskManagement.entities[response.id];
      const currentGrouping = state.taskManagement.grouping;

      if (currentTask) {
        // Get priority list to map priority_id to priority name
        const priorityList = state.priorityReducer?.priorities || [];
        let newPriorityValue: 'critical' | 'high' | 'medium' | 'low' = 'medium';

        if (response.priority_id) {
          const priority = priorityList.find(p => p.id === response.priority_id);
          if (priority?.name) {
            const priorityName = priority.name.toLowerCase();
            if (['critical', 'high', 'medium', 'low'].includes(priorityName)) {
              newPriorityValue = priorityName as 'critical' | 'high' | 'medium' | 'low';
            }
          }
        } else {
          // No priority selected (cleared) - default to medium or find unmapped
          newPriorityValue = 'medium';
        }

        // Update the task entity first
        dispatch(
          updateTask({
            ...currentTask,
            priority: newPriorityValue,
            updatedAt: new Date().toISOString(),
          })
        );

        // Handle group movement ONLY if grouping by priority
        const groups = state.taskManagement.groups;

        if (groups && groups.length > 0 && currentGrouping === 'priority') {
          // Find current group containing the task
          const currentGroup = groups.find(group => group.taskIds.includes(response.id));

          // Find target group based on new priority value
          let targetGroup: any = null;

          if (response.priority_id) {
            // Find group by priority name (groupValue should match the priority name)
            targetGroup = groups.find(
              group =>
                group.groupValue?.toLowerCase() === newPriorityValue.toLowerCase() ||
                group.title?.toLowerCase() === newPriorityValue.toLowerCase()
            );
          } else {
            // Find "Unmapped" group for tasks without a priority
            targetGroup = groups.find(
              group =>
                group.groupValue === 'Unmapped' ||
                group.title === 'Unmapped' ||
                group.groupValue === '' ||
                group.title?.toLowerCase().includes('unmapped') ||
                group.groupValue?.toLowerCase().includes('unmapped')
            );
          }

          if (currentGroup && targetGroup && currentGroup.id !== targetGroup.id) {
            dispatch(
              moveTaskBetweenGroups({
                taskId: response.id,
                sourceGroupId: currentGroup.id,
                targetGroupId: targetGroup.id,
              })
            );
          } else if (!targetGroup && response.priority_id) {
            // Target priority group not found
          } else {
            // No group movement needed for priority change
          }
        } else {
          // Not grouped by priority, skipping group movement
        }
      }
    },
    [dispatch, currentGroupingV3]
  );

  const handleDueTimeChange = useCallback(
    (data: { id: string; due_time: string | null } | null) => {
      if (!data) return;
      const currentTask = store.getState().taskManagement.entities[data.id];
      if (currentTask) {
        dispatch(updateTask({ ...currentTask, due_time: data.due_time }));
      }
    },
    [dispatch]
  );

  const handleEndDateChange = useCallback(
    (task: { id: string; parent_task: string | null; end_date: string }) => {
      if (!task) return;

      const taskWithProgress = {
        ...task,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskEndDate({ task: taskWithProgress }));
      dispatch(setTaskEndDate(taskWithProgress));

      // Update enhanced kanban slice
      dispatch(updateEnhancedKanbanTaskEndDate({ task: taskWithProgress }));

      // Update task-management slice for task-list-v2 components
      const currentTask = store.getState().taskManagement.entities[task.id];
      if (currentTask) {
        dispatch(
          updateTask({
            ...currentTask,
            dueDate: task.end_date,
            updatedAt: new Date().toISOString(),
          })
        );
      }
    },
    [dispatch]
  );

  const handleTaskNameChange = useCallback(
    (data: { id: string; parent_task: string; name: string }) => {
      if (!data) return;
      const decodedData = {
        ...data,
        name: decodeHtmlEntities(data.name),
      };

      // Update the old task slice (for backward compatibility)
      dispatch(updateTaskName(decodedData));
      dispatch(updateSelectedTaskName(decodedData));

      // For the task management slice, update task name
      if (decodedData.id) {
        const currentTask = store.getState().taskManagement.entities[decodedData.id];
        if (currentTask) {
          const updatedTask: Task = {
            ...currentTask,
            title: decodedData.name,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));
        }
      }

      // Update enhanced kanban slice (add manual_progress property for compatibility)
      const taskWithProgress = {
        ...decodedData,
        manual_progress: false,
      } as IProjectTask;
      dispatch(updateEnhancedKanbanTaskName({ task: taskWithProgress }));
    },
    [dispatch]
  );

  const handlePhaseChange = useCallback(
    (data: ITaskPhaseChangeResponse) => {
      if (!data) return;

      // Update the old task slice (for backward compatibility)
      dispatch(updateTaskPhase(data));
      dispatch(deselectAll());

      // For the task management slice, always update the task entity first
      const state = store.getState();
      const taskId = data.task_id;

      if (taskId) {
        const currentTask = state.taskManagement.entities[taskId];

        if (currentTask) {
          // Get phase list to map phase_id to phase name
          const phaseList = state.phaseReducer?.phaseList || [];
          let newPhaseValue = '';

          if (data.id) {
            // data.id is the phase_id
            const phase = phaseList.find(p => p.id === data.id);
            newPhaseValue = phase?.name || '';
          } else {
            // No phase selected (cleared)
            newPhaseValue = '';
          }

          // Update the task entity
          const updatedTask: Task = {
            ...currentTask,
            phase: newPhaseValue,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));

          // Handle group movement ONLY if grouping by phase
          const groups = state.taskManagement.groups;
          const currentGrouping = state.taskManagement.grouping;

          if (groups && groups.length > 0 && currentGrouping === 'phase') {
            // Find current group containing the task
            const currentGroup = groups.find(group => group.taskIds.includes(taskId));

            // Find target group based on new phase value
            let targetGroup: any = null;

            if (newPhaseValue && newPhaseValue.trim() !== '') {
              // Find group by phase name (groupValue should match the phase name)
              targetGroup = groups.find(
                group =>
                  group.groupValue === newPhaseValue ||
                  group.title === newPhaseValue ||
                  group.groupValue?.toLowerCase() === newPhaseValue.toLowerCase() ||
                  group.title?.toLowerCase() === newPhaseValue.toLowerCase()
              );
            } else {
              // Find "Unmapped" group for tasks without a phase
              targetGroup = groups.find(
                group =>
                  group.groupValue === 'Unmapped' ||
                  group.title === 'Unmapped' ||
                  group.groupValue === '' ||
                  group.title?.toLowerCase().includes('unmapped') ||
                  group.groupValue?.toLowerCase().includes('unmapped')
              );
            }

            if (currentGroup && targetGroup && currentGroup.id !== targetGroup.id) {
              dispatch(
                moveTaskBetweenGroups({
                  taskId: taskId,
                  sourceGroupId: currentGroup.id,
                  targetGroupId: targetGroup.id,
                })
              );
            } else if (!targetGroup && newPhaseValue) {
              // Target phase group not found
            } else {
              // No group movement needed for phase change
            }
          }
        } else {
          // Not grouped by phase, skipping group movement
        }
      }
    },
    [dispatch, currentGroupingV3]
  );

  const handleStartDateChange = useCallback(
    (task: { id: string; parent_task: string | null; start_date: string }) => {
      if (!task) return;

      const taskWithProgress = {
        ...task,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskStartDate({ task: taskWithProgress }));
      dispatch(setStartDate(taskWithProgress));

      // Update task-management slice for task-list-v2 components
      const currentTask = store.getState().taskManagement.entities[task.id];
      if (currentTask) {
        const updatedTask: Task = {
          ...currentTask,
          startDate: task.start_date,
          updatedAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        dispatch(updateTask(updatedTask));
      }
    },
    [dispatch]
  );

  const handleTaskSubscribersChange = useCallback(
    (subscribers: InlineMember[]) => {
      if (!subscribers) return;
      dispatch(setTaskSubscribers(subscribers));

      // Note: We don't have task_id in this event, so we can't update the task-management slice
      // The has_subscribers field will be updated when the task is refetched
    },
    [dispatch]
  );

  const handleEstimationChange = useCallback(
    (data: {
      id: string;
      parent_task: string | null;
      total_hours: number;
      total_minutes: number;
    }) => {
      if (!data) return;

      // Update the old task slice (for backward compatibility)
      const taskWithProgress = {
        ...data,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskEstimation({ task: taskWithProgress }));

      // Update task-management slice for task-list-v2 components
      const currentTask = store.getState().taskManagement.entities[data.id];
      if (currentTask) {
        // total_minutes from backend is the complete value in minutes, not additional minutes
        const estimatedHours = (data.total_minutes || 0) / 60;
        const updatedTask: Task = {
          ...currentTask,
          timeTracking: {
            ...currentTask.timeTracking,
            estimated: estimatedHours,
          },
          updatedAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        dispatch(updateTask(updatedTask));
      }
    },
    [dispatch]
  );

  const handleTaskDescriptionChange = useCallback(
    (data: { id: string; parent_task: string; description: string }) => {
      if (!data) return;

      // Update the old task slice (for backward compatibility)
      dispatch(updateTaskDescription(data));

      // Update task-management slice for task-list-v2 components
      const currentTask = store.getState().taskManagement.entities[data.id];
      if (currentTask) {
        const updatedTask: Task = {
          ...currentTask,
          description: data.description,
          updatedAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        dispatch(updateTask(updatedTask));
      }

      // Update task drawer so the description editor reflects the change in real time.
      dispatch(setTaskDescription({ id: data.id, description: data.description ?? null }));
    },
    [dispatch]
  );

  const handleNewTaskReceived = useCallback(
    (response: any) => {
      // Get current sort field from Redux state
      const sortField = store.getState().taskManagement.sortField;

      // If sorting by task_key, refetch to maintain correct sort order
      if (sortField === 'task_key' && projectId) {
        dispatch(fetchTasksV3(projectId));
        return;
      }

      handleTaskReceivedUtil(response, {
        dispatch,
        currentGroupingV3: currentGroupingV3,
        enhancedKanbanGroupBy: enhancedKanbanGroupBy,
        trackEvent: trackMixpanelEvent,
        subtaskEventName: evt_project_task_list_create_subtask,
        taskEventName: evt_project_task_create,
      });
    },
    [dispatch, trackMixpanelEvent, currentGroupingV3, enhancedKanbanGroupBy, projectId]
  );

  const handleTaskProgressUpdated = useCallback(
    (data: { task_id: string; progress_value?: number; weight?: number }) => {
      if (!data) return;

      if (data.progress_value !== undefined) {
        // Update the old task slice (for backward compatibility)
        // Always dispatch the update, even if we don't find the task in taskGroups
        let totalTasksCount = 0;
        let completedCount = 0;

        if (taskGroups) {
          let taskFound = false;
          for (const group of taskGroups) {
            const task = group.tasks?.find((task: IProjectTask) => task.id === data.task_id);
            if (task) {
              totalTasksCount = task.total_tasks_count || 0;
              completedCount = task.completed_count || 0;
              taskFound = true;
              break;
            }

            // Also check subtasks
            for (const parentTask of group.tasks || []) {
              if (parentTask.sub_tasks) {
                const subtask = parentTask.sub_tasks.find(
                  (st: IProjectTask) => st.id === data.task_id
                );
                if (subtask) {
                  totalTasksCount = subtask.total_tasks_count || 0;
                  completedCount = subtask.completed_count || 0;
                  taskFound = true;
                  break;
                }
              }
            }
            if (taskFound) break;
          }
        }

        // Always dispatch the update
        dispatch(
          updateTaskProgress({
            taskId: data.task_id,
            progress: data.progress_value,
            totalTasksCount,
            completedCount,
          })
        );

        // Update the task-management slice for task-list-v2 components
        const currentTask = store.getState().taskManagement.entities[data.task_id];
        if (currentTask) {
          const updatedTask: Task = {
            ...currentTask,
            progress: data.progress_value,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));
        }

        // Update enhanced kanban slice
        dispatch(
          updateEnhancedKanbanTaskProgress({
            id: data.task_id,
            complete_ratio: data.progress_value,
            completed_count: 0,
            total_tasks_count: 0,
            parent_task: '',
          })
        );
      }
    },
    [dispatch, taskGroups]
  );

  const handleCustomColumnUpdate = useCallback(
    (
      data:
        | string
        | {
            task_id: string;
            column_key: string;
            value: string | number | boolean | string[] | null;
          }
    ) => {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

      if (!parsedData || !parsedData.task_id || !parsedData.column_key) return;

      // Update the task-management slice for task-list-v2 components
      const currentTask = store.getState().taskManagement.entities[parsedData.task_id];
      if (currentTask) {
        const updatedCustomColumnValues = {
          ...currentTask.custom_column_values,
          [parsedData.column_key]: parsedData.value,
        };

        const updatedTask: Task = {
          ...currentTask,
          custom_column_values: updatedCustomColumnValues,
          updatedAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        dispatch(updateTask(updatedTask));
      }
    },
    [dispatch]
  );

  // Handler for TASK_ASSIGNEES_CHANGE (fallback event with limited data)
  const handleTaskAssigneesChange = useCallback((data: { assigneeIds: string[] }) => {
    if (!data || !data.assigneeIds) return;
  }, []);

  // Handler for billable status changes
  const handleBillableChange = useCallback(
    (data: { id: string; billable: boolean; error?: string }) => {
      if (!data || data.error) return;

      // Update the task drawer if this task is currently open
      const state = store.getState();
      const currentTaskId = state.taskDrawerReducer?.selectedTaskId;

      if (currentTaskId === data.id) {
        // Import the action dynamically to avoid circular dependencies
        import('@/features/task-drawer/task-drawer.slice').then(({ setTaskBillable }) => {
          dispatch(setTaskBillable({ id: data.id, billable: data.billable }));
        });
      }

      // Update the task-management slice for task-list-v2 components
      const currentTask = state.taskManagement.entities[data.id];
      if (currentTask) {
        const updatedTask: Task = {
          ...currentTask,
          billable: data.billable,
          updatedAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        dispatch(updateTask(updatedTask));
      }
    },
    [dispatch]
  );

  // Handler for timer start events
  const handleTimerStart = useCallback(
    (data: string) => {
      try {
        const { task_id, start_time } = typeof data === 'string' ? JSON.parse(data) : data;
        if (!task_id) return;

        const timerTimestamp = start_time
          ? typeof start_time === 'number'
            ? start_time
            : parseInt(start_time)
          : Date.now();

        // Update the task-management slice to include timer state
        const currentTask = store.getState().taskManagement.entities[task_id];
        if (currentTask) {
          const updatedTask: Task = {
            ...currentTask,
            timeTracking: {
              ...currentTask.timeTracking,
              activeTimer: timerTimestamp,
            },
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));
        }

        // Also update the tasks slice activeTimers to keep both slices in sync
        dispatch(updateTaskTimeTracking({ taskId: task_id, timeTracking: timerTimestamp }));
      } catch (error) {
        logger.error('Error handling timer start event:', error);
      }
    },
    [dispatch]
  );

  // Handler for timer stop events
  const handleTimerStop = useCallback(
    (data: string) => {
      try {
        const { task_id } = typeof data === 'string' ? JSON.parse(data) : data;
        if (!task_id) return;

        // Update the task-management slice to remove timer state
        const currentTask = store.getState().taskManagement.entities[task_id];
        if (currentTask) {
          const updatedTask: Task = {
            ...currentTask,
            timeTracking: {
              ...currentTask.timeTracking,
              activeTimer: undefined,
            },
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));
        }

        // Also update the tasks slice activeTimers to keep both slices in sync
        dispatch(updateTaskTimeTracking({ taskId: task_id, timeTracking: null }));
      } catch (error) {
        logger.error('Error handling timer stop event:', error);
      }
    },
    [dispatch]
  );

  // Handler for task sort order change events
  const handleTaskSortOrderChange = useCallback(
    (data: any[]) => {
      try {
        if (!Array.isArray(data) || data.length === 0) return;

        // Get canonical lists from Redux
        const state = store.getState();
        const priorityList = state.priorityReducer?.priorities || [];
        const phaseList = state.phaseReducer?.phaseList || [];
        const statusList = state.taskStatusReducer?.status || [];

        const nextOrderByTaskId = new Map<string, number>();

        // The backend sends an array of tasks with updated sort orders and possibly grouping fields
        data.forEach((taskData: any) => {
          const currentTask = state.taskManagement.entities[taskData.id];
          if (currentTask) {
            const nextOrder =
              taskData.current_sort_order ?? taskData.sort_order ?? currentTask.order;
            nextOrderByTaskId.set(taskData.id, nextOrder);

            let updatedTask: Task = {
              ...currentTask,
              order: nextOrder,
              updatedAt: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // Update grouping fields if present
            if (typeof taskData.priority_id !== 'undefined') {
              const found = priorityList.find(p => p.id === taskData.priority_id);
              if (found) {
                updatedTask.priority = found.name;
                // updatedTask.priority_id = found.id; // Only if Task type has priority_id
              } else {
                updatedTask.priority = taskData.priority_id || '';
                // updatedTask.priority_id = taskData.priority_id;
              }
            }
            if (typeof taskData.phase_id !== 'undefined') {
              const found = phaseList.find(p => p.id === taskData.phase_id);
              if (found) {
                updatedTask.phase = found.name;
                // updatedTask.phase_id = found.id; // Only if Task type has phase_id
              } else {
                updatedTask.phase = taskData.phase_id || '';
                // updatedTask.phase_id = taskData.phase_id;
              }
            }
            if (typeof taskData.status_id !== 'undefined') {
              const found = statusList.find(s => s.id === taskData.status_id);
              // Keep status as the canonical ID for consistency across grouping/color logic
              updatedTask.status = found?.id || taskData.status_id || '';
            }

            dispatch(updateTask(updatedTask));
          }
        });

        const groups = state.taskManagement.groups || [];
        groups.forEach((group: any) => {
          if (!Array.isArray(group?.taskIds) || group.taskIds.length < 2) return;

          const sortedTaskIds = [...group.taskIds].sort((taskIdA: string, taskIdB: string) => {
            const orderA =
              nextOrderByTaskId.get(taskIdA) ?? state.taskManagement.entities[taskIdA]?.order ?? 0;
            const orderB =
              nextOrderByTaskId.get(taskIdB) ?? state.taskManagement.entities[taskIdB]?.order ?? 0;
            return orderA - orderB;
          });

          const hasOrderChanged = sortedTaskIds.some(
            (taskId, index) => taskId !== group.taskIds[index]
          );
          if (hasOrderChanged) {
            dispatch(reorderTasks({ taskIds: sortedTaskIds, groupId: group.id }));
          }
        });
      } catch (error) {
        logger.error('Error handling task sort order change event:', error);
      }
    },
    [dispatch]
  );

  // Handler for PROJECT_UPDATES_AVAILABLE event (e.g., task deletion)
  const handleProjectUpdatesAvailable = useCallback(() => {
    // Refresh task list when project updates are available (includes task deletion, creation, etc.)
    if (projectId) {
      dispatch(fetchTasksV3(projectId));
    }
  }, [dispatch, projectId]);

  // Register socket event listeners
  useEffect(() => {
    if (!socket) return;

    const eventHandlers = [
      { event: SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handler: handleAssigneesUpdate },
      { event: SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), handler: handleTaskAssigneesChange },
      { event: SocketEvents.TASK_BILLABLE_CHANGE.toString(), handler: handleBillableChange },
      { event: SocketEvents.TASK_LABELS_CHANGE.toString(), handler: handleLabelsChange },
      { event: SocketEvents.CREATE_LABEL.toString(), handler: handleLabelsChange },
      { event: SocketEvents.TASK_STATUS_CHANGE.toString(), handler: handleTaskStatusChange },
      { event: SocketEvents.GET_TASK_PROGRESS.toString(), handler: handleTaskProgress },
      { event: SocketEvents.TASK_PROGRESS_UPDATED.toString(), handler: handleTaskProgress },
      { event: SocketEvents.TASK_PRIORITY_CHANGE.toString(), handler: handlePriorityChange },
      { event: SocketEvents.TASK_END_DATE_CHANGE.toString(), handler: handleEndDateChange },
      { event: SocketEvents.TASK_DUE_TIME_CHANGE.toString(), handler: handleDueTimeChange },
      { event: SocketEvents.TASK_NAME_CHANGE.toString(), handler: handleTaskNameChange },
      { event: SocketEvents.TASK_PHASE_CHANGE.toString(), handler: handlePhaseChange },
      { event: SocketEvents.TASK_START_DATE_CHANGE.toString(), handler: handleStartDateChange },
      {
        event: SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(),
        handler: handleTaskSubscribersChange,
      },
      {
        event: SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(),
        handler: handleEstimationChange,
      },
      {
        event: SocketEvents.TASK_DESCRIPTION_CHANGE.toString(),
        handler: handleTaskDescriptionChange,
      },
      { event: SocketEvents.QUICK_TASK.toString(), handler: handleNewTaskReceived },
      { event: SocketEvents.TASK_PROGRESS_UPDATED.toString(), handler: handleTaskProgressUpdated },
      {
        event: SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
        handler: handleCustomColumnUpdate,
      },
      { event: SocketEvents.TASK_TIMER_START.toString(), handler: handleTimerStart },
      { event: SocketEvents.TASK_TIMER_STOP.toString(), handler: handleTimerStop },
      { event: SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), handler: handleTaskSortOrderChange },
      {
        event: SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(),
        handler: handleProjectUpdatesAvailable,
      },
    ];

    // Register all event listeners
    eventHandlers.forEach(({ event, handler }) => {
      socket.on(event, handler);
    });

    // Cleanup function
    return () => {
      eventHandlers.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    };
  }, [
    socket,
    handleAssigneesUpdate,
    handleTaskAssigneesChange,
    handleBillableChange,
    handleLabelsChange,
    handleTaskStatusChange,
    handleTaskProgress,
    handlePriorityChange,
    handleEndDateChange,
    handleDueTimeChange,
    handleTaskNameChange,
    handlePhaseChange,
    handleStartDateChange,
    handleTaskSubscribersChange,
    handleEstimationChange,
    handleTaskDescriptionChange,
    handleNewTaskReceived,
    handleTaskProgressUpdated,
    handleCustomColumnUpdate,
    handleTimerStart,
    handleTimerStop,
    handleTaskSortOrderChange,
    handleProjectUpdatesAvailable,
  ]);
};
