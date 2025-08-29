import { useCallback, useEffect } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import alertService from '@/services/alerts/alertService';
import { store } from '@/app/store';

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
} from '@/features/task-drawer/task-drawer.slice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';

export const useTaskSocketHandlers = () => {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();

  const { loadingAssignees, taskGroups } = useAppSelector((state: any) => state.taskReducer);
  const { projectId } = useAppSelector((state: any) => state.projectReducer);
  const currentGroupingV3 = useAppSelector(selectCurrentGroupingV3);

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
        // Remove unnecessary refetches - real-time updates handle this
        // dispatch(fetchLabels()),
        // projectId && dispatch(fetchLabelsByProject(projectId)),
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

      if (currentTask) {
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

        // Update the task entity first
        dispatch(
          updateTask({
            ...currentTask,
            status: response.status_id || newStatusValue, // Use actual status_id instead of category
            progress: response.complete_ratio || currentTask.progress,
            updatedAt: new Date().toISOString(),
          })
        );

        // Handle group movement ONLY if grouping by status
        if (groups && groups.length > 0 && currentGrouping === 'status') {
          // Find current group containing the task
          const currentGroup = groups.find(group => group.taskIds.includes(response.id));

          // Find target group based on the actual status ID from response
          let targetGroup = groups.find(group => group.id === response.status_id);

          // If not found by status ID, try matching with group value
          if (!targetGroup) {
            targetGroup = groups.find(group => group.groupValue === response.status_id);
          }

          // If still not found, try matching by status name (fallback)
          if (!targetGroup && response.status) {
            targetGroup = groups.find(
              group => group.title?.toLowerCase() === response.status.toLowerCase()
            );
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
          parent_task: data.parent_task,
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
            console.log('🔧 Target priority group not found for priority:', newPriorityValue);
          } else {
            console.log('🔧 No group movement needed for priority change');
          }
        } else {
          console.log('🔧 Not grouped by priority, skipping group movement');
        }
      }
    },
    [dispatch, currentGroupingV3]
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

      // Update the old task slice (for backward compatibility)
      dispatch(updateTaskName(data));

      // For the task management slice, update task name
      if (data.id) {
        const currentTask = store.getState().taskManagement.entities[data.id];
        if (currentTask) {
          const updatedTask: Task = {
            ...currentTask,
            title: data.name,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          dispatch(updateTask(updatedTask));
        }
      }

      // Update enhanced kanban slice (add manual_progress property for compatibility)
      const taskWithProgress = {
        ...data,
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
              console.log('🔧 Target phase group not found for phase:', newPhaseValue);
            } else {
              console.log('🔧 No group movement needed for phase change');
            }
          } else {
            console.log('🔧 Not grouped by phase, skipping group movement');
          }
        }
      }
    },
    [dispatch, currentGroupingV3, projectId]
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
        const estimatedHours = (data.total_hours || 0) + (data.total_minutes || 0) / 60;
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
    },
    [dispatch]
  );

  const handleNewTaskReceived = useCallback(
    (response: any) => {
      // Handle array format response [index, taskData]
      const data = Array.isArray(response) ? response[1] : response;
      if (!data) return;
      if (data.parent_task_id) {
        // Handle subtask creation
        const subtask: Task = {
          id: data.id || '',
          task_key: data.task_key || '',
          title: data.name || '',
          description: data.description || '',
          status: (data.status_category?.is_todo
            ? 'todo'
            : data.status_category?.is_doing
              ? 'doing'
              : data.status_category?.is_done
                ? 'done'
                : 'todo') as 'todo' | 'doing' | 'done',
          priority: (data.priority_value === 3
            ? 'critical'
            : data.priority_value === 2
              ? 'high'
              : data.priority_value === 1
                ? 'medium'
                : 'low') as 'critical' | 'high' | 'medium' | 'low',
          phase: data.phase_name || 'Development',
          progress: data.complete_ratio || 0,
          assignees: data.assignees?.map((a: any) => a.team_member_id) || [],
          assignee_names: data.names || [],
          labels:
            data.labels?.map((l: any) => ({
              id: l.id || '',
              name: l.name || '',
              color: l.color_code || '#1890ff',
              end: l.end,
              names: l.names,
            })) || [],
          dueDate: data.end_date,
          timeTracking: {
            estimated: (data.total_hours || 0) + (data.total_minutes || 0) / 60,
            logged: (data.time_spent?.hours || 0) + (data.time_spent?.minutes || 0) / 60,
          },
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
          order: data.sort_order || 0,
          parent_task_id: data.parent_task_id,
          is_sub_task: true,
        };

        // Before adding the real subtask, remove any temporary subtasks with the same name
        // This prevents duplication from optimistic updates
        const parentTask = store.getState().taskManagement.entities[data.parent_task_id];
        if (parentTask && parentTask.sub_tasks) {
          const temporarySubtasks = parentTask.sub_tasks.filter(
            (st: Task) => st.isTemporary && st.name === subtask.title
          );

          // Remove each temporary subtask
          temporarySubtasks.forEach((tempSubtask: Task) => {
            dispatch(
              removeTemporarySubtask({
                parentTaskId: data.parent_task_id,
                tempId: tempSubtask.id,
              })
            );
          });
        }

        dispatch(addSubtaskToParent({ parentId: data.parent_task_id, subtask }));

        // Also update enhanced kanban slice for subtask creation
        dispatch(
          updateEnhancedKanbanSubtask({
            sectionId: '',
            subtask: data,
            mode: 'add',
          })
        );
      } else {
        // Handle regular task creation - transform to Task format and add
        const task: Task = {
          id: data.id || '',
          task_key: data.task_key || '',
          title: data.name || '',
          description: data.description || '',
          status: data.status || 'todo',
          priority: (data.priority_value === 3
            ? 'critical'
            : data.priority_value === 2
              ? 'high'
              : data.priority_value === 1
                ? 'medium'
                : 'low') as 'critical' | 'high' | 'medium' | 'low',
          phase: data.phase_name || 'Development',
          progress: data.complete_ratio || 0,
          assignees: data.assignees?.map((a: any) => a.team_member_id) || [],
          assignee_names: data.names || [],
          labels:
            data.labels?.map((l: any) => ({
              id: l.id || '',
              name: l.name || '',
              color: l.color_code || '#1890ff',
              end: l.end,
              names: l.names,
            })) || [],
          dueDate: data.end_date,
          startDate: data.start_date,
          timeTracking: {
            estimated: (data.total_hours || 0) + (data.total_minutes || 0) / 60,
            logged: (data.time_spent?.hours || 0) + (data.time_spent?.minutes || 0) / 60,
          },
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
          order: data.sort_order || 0,
          sub_tasks: [],
          sub_tasks_count: 0,
          show_sub_tasks: false,
        };

        // Extract the group UUID from the backend response based on current grouping
        let groupId: string | undefined;

        // Select the correct UUID based on current grouping
        // If currentGroupingV3 is null, default to 'status' since that's the most common grouping
        const grouping = currentGroupingV3 || 'status';

        if (grouping === 'status') {
          // For status grouping, use status field (which contains the status UUID)
          groupId = data.status;
        } else if (grouping === 'priority') {
          // For priority grouping, use priority field (which contains the priority UUID)
          groupId = data.priority;
        } else if (grouping === 'phase') {
          // For phase grouping, use phase_id, or 'Unmapped' if no phase_id
          groupId = data.phase_id || 'Unmapped';
        }

        // Use addTaskToGroup with the actual group UUID
        dispatch(addTaskToGroup({ task, groupId: groupId || '' }));

        // Also update enhanced kanban slice for regular task creation
        dispatch(
          addEnhancedKanbanTaskToGroup({
            sectionId: groupId || '',
            task: data,
          })
        );
      }
    },
    [dispatch]
  );

  const handleTaskProgressUpdated = useCallback(
    (data: { task_id: string; progress_value?: number; weight?: number }) => {
      if (!data || !taskGroups) return;

      if (data.progress_value !== undefined) {
        for (const group of taskGroups) {
          const task = group.tasks?.find((task: IProjectTask) => task.id === data.task_id);
          if (task) {
            dispatch(
              updateTaskProgress({
                taskId: data.task_id,
                progress: data.progress_value,
                totalTasksCount: task.total_tasks_count || 0,
                completedCount: task.completed_count || 0,
              })
            );
            break;
          }
        }
      }
    },
    [dispatch, taskGroups]
  );

  const handleCustomColumnUpdate = useCallback(
    (data: { task_id: string; column_key: string; value: string }) => {
      if (!data || !data.task_id || !data.column_key) return;

      // Update the task-management slice for task-list-v2 components
      const currentTask = store.getState().taskManagement.entities[data.task_id];
      if (currentTask) {
        const updatedCustomColumnValues = {
          ...currentTask.custom_column_values,
          [data.column_key]: data.value,
        };

        const updatedTask: Task = {
          ...currentTask,
          custom_column_values: updatedCustomColumnValues,
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

        // DEBUG: Log the data received from the backend
        console.log('[TASK_SORT_ORDER_CHANGE] Received data:', data);

        // Get canonical lists from Redux
        const state = store.getState();
        const priorityList = state.priorityReducer?.priorities || [];
        const phaseList = state.phaseReducer?.phaseList || [];
        const statusList = state.taskStatusReducer?.status || [];

        // The backend sends an array of tasks with updated sort orders and possibly grouping fields
        data.forEach((taskData: any) => {
          const currentTask = state.taskManagement.entities[taskData.id];
          if (currentTask) {
            let updatedTask: Task = {
              ...currentTask,
              order: taskData.sort_order || taskData.current_sort_order || currentTask.order,
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
              if (found) {
                updatedTask.status = found.name;
                // updatedTask.status_id = found.id; // Only if Task type has status_id
              } else {
                updatedTask.status = taskData.status_id || '';
                // updatedTask.status_id = taskData.status_id;
              }
            }

            dispatch(updateTask(updatedTask));
          }
        });
      } catch (error) {
        logger.error('Error handling task sort order change event:', error);
      }
    },
    [dispatch]
  );

  // Register socket event listeners
  useEffect(() => {
    if (!socket) return;

    const eventHandlers = [
      { event: SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handler: handleAssigneesUpdate },
      { event: SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), handler: handleTaskAssigneesChange },
      { event: SocketEvents.TASK_LABELS_CHANGE.toString(), handler: handleLabelsChange },
      { event: SocketEvents.CREATE_LABEL.toString(), handler: handleLabelsChange },
      { event: SocketEvents.TASK_STATUS_CHANGE.toString(), handler: handleTaskStatusChange },
      { event: SocketEvents.TASK_PROGRESS_UPDATED.toString(), handler: handleTaskProgress },
      { event: SocketEvents.TASK_PRIORITY_CHANGE.toString(), handler: handlePriorityChange },
      { event: SocketEvents.TASK_END_DATE_CHANGE.toString(), handler: handleEndDateChange },
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
    handleLabelsChange,
    handleTaskStatusChange,
    handleTaskProgress,
    handlePriorityChange,
    handleEndDateChange,
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
  ]);
};
