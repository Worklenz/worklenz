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
} from '@/features/tasks/tasks.slice';
import {
  addTask, 
  addTaskToGroup,
  updateTask, 
  moveTaskToGroup,
  moveTaskBetweenGroups,
  selectCurrentGroupingV3,
  fetchTasksV3
} from '@/features/task-management/task-management.slice';
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

      const updatedAssignees = data.assignees?.map(assignee => ({
        ...assignee,
        selected: true,
      })) || [];

      const groupId = taskGroups?.find((group: ITaskListGroup) =>
        group.tasks?.some(
          (task: IProjectTask) =>
            task.id === data.id ||
            (task.sub_tasks && task.sub_tasks.some((subtask: IProjectTask) => subtask.id === data.id))
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

        if (currentSession?.team_id && !loadingAssignees) {
          dispatch(fetchTaskAssignees(currentSession.team_id));
        }
      }
    },
    [taskGroups, dispatch, currentSession?.team_id, loadingAssignees]
  );

  const handleLabelsChange = useCallback(
    async (labels: ILabelsChangeResponse) => {
      if (!labels) return;
      
      await Promise.all([
        dispatch(updateTaskLabel(labels)),
        dispatch(setTaskLabels(labels)),
        dispatch(fetchLabels()),
        projectId && dispatch(fetchLabelsByProject(projectId)),
      ]);
    },
    [dispatch, projectId]
  );

  const handleTaskStatusChange = useCallback(
    (response: ITaskListStatusChangeResponse) => {
      if (!response) return;

      console.log('🔄 Status change received:', response);

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

      // For the task management slice, move task between groups without resetting
      const state = store.getState();
      const groups = state.taskManagement.groups;
      const currentTask = state.taskManagement.entities[response.id];
      
      console.log('🔍 Status change debug:', {
        hasGroups: !!groups,
        groupsLength: groups?.length || 0,
        hasCurrentTask: !!currentTask,
        statusId: response.status_id,
        currentGrouping: state.taskManagement.grouping
      });
      
      if (groups && groups.length > 0 && currentTask && response.status_id) {
        // Find current group containing the task
        const currentGroup = groups.find(group => group.taskIds.includes(response.id));
        
        // Find target group based on new status ID
        // The status_id from response is the UUID of the new status
        const targetGroup = groups.find(group => group.id === response.status_id);
        
        if (currentGroup && targetGroup && currentGroup.id !== targetGroup.id) {
          console.log('🔄 Moving task between groups:', {
            taskId: response.id,
            fromGroup: currentGroup.title,
            toGroup: targetGroup.title
          });
          
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
          
          // Use the new action to move task between groups
          dispatch(moveTaskBetweenGroups({
            taskId: response.id,
            fromGroupId: currentGroup.id,
            toGroupId: targetGroup.id,
            taskUpdate: {
              status: newStatusValue,
              progress: response.complete_ratio || currentTask.progress,
            }
          }));
        } else if (!currentGroup || !targetGroup) {
          // Fallback to refetch if groups not found (shouldn't happen normally)
          console.log('🔄 Groups not found, refetching tasks...');
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
        dispatch(updateTask({
          id: taskId,
          changes: {
            progress: data.complete_ratio,
            updatedAt: new Date().toISOString(),
          }
        }));
      }
    },
    [dispatch]
  );

  const handlePriorityChange = useCallback(
    (response: ITaskListPriorityChangeResponse) => {
      if (!response) return;

      console.log('🎯 Priority change received:', response);

      // Update the old task slice (for backward compatibility)
      dispatch(updateTaskPriority(response));
      dispatch(setTaskPriority(response));
      dispatch(deselectAll());

      // For the task management slice, always update the task entity first
      const state = store.getState();
      const currentTask = state.taskManagement.entities[response.id];
      
      if (currentTask) {
        // Get priority list to map priority_id to priority name
        const priorityList = state.priorityReducer?.priorities || [];
        const priority = priorityList.find(p => p.id === response.priority_id);
        
        let newPriorityValue: 'critical' | 'high' | 'medium' | 'low' = 'medium';
        if (priority?.name) {
          const priorityName = priority.name.toLowerCase();
          if (['critical', 'high', 'medium', 'low'].includes(priorityName)) {
            newPriorityValue = priorityName as 'critical' | 'high' | 'medium' | 'low';
          }
        }

        console.log('🔧 Updating task priority:', {
          taskId: response.id,
          oldPriority: currentTask.priority,
          newPriority: newPriorityValue,
          priorityId: response.priority_id,
          currentGrouping: state.taskManagement.grouping
        });

        // Update the task entity
        dispatch(updateTask({
          id: response.id,
          changes: {
            priority: newPriorityValue,
            updatedAt: new Date().toISOString(),
          }
        }));

        // Handle group movement ONLY if grouping by priority
        const groups = state.taskManagement.groups;
        const currentGrouping = state.taskManagement.grouping;
        
        if (groups && groups.length > 0 && currentGrouping === 'priority') {
          // Find current group containing the task
          const currentGroup = groups.find(group => group.taskIds.includes(response.id));
          
          // Find target group based on new priority value
          const targetGroup = groups.find(group => 
            group.groupValue.toLowerCase() === newPriorityValue.toLowerCase()
          );
          
          if (currentGroup && targetGroup && currentGroup.id !== targetGroup.id) {
            console.log('🔄 Moving task between priority groups:', {
              taskId: response.id,
              fromGroup: currentGroup.title,
              toGroup: targetGroup.title,
              newPriority: newPriorityValue
            });
            
            dispatch(moveTaskBetweenGroups({
              taskId: response.id,
              fromGroupId: currentGroup.id,
              toGroupId: targetGroup.id,
              taskUpdate: {
                priority: newPriorityValue,
              }
            }));
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
    (task: {
      id: string;
      parent_task: string | null;
      end_date: string;
    }) => {
      if (!task) return;

      const taskWithProgress = {
        ...task,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskEndDate({ task: taskWithProgress }));
      dispatch(setTaskEndDate(taskWithProgress));
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
        dispatch(updateTask({
          id: data.id,
          changes: {
            title: data.name,
            updatedAt: new Date().toISOString(),
          }
        }));
      }
    },
    [dispatch]
  );

  const handlePhaseChange = useCallback(
    (data: ITaskPhaseChangeResponse) => {
      if (!data) return;
      
      console.log('🎯 Phase change received:', data);
      
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

        console.log('🔧 Updating task phase:', {
          taskId: taskId,
          oldPhase: currentTask.phase,
          newPhase: newPhaseValue,
          phaseId: data.id,
          currentGrouping: state.taskManagement.grouping
        });

        // Update the task entity
        dispatch(updateTask({
          id: taskId,
          changes: {
            phase: newPhaseValue,
            updatedAt: new Date().toISOString(),
          }
        }));

        // Handle group movement ONLY if grouping by phase
        const groups = state.taskManagement.groups;
        const currentGrouping = state.taskManagement.grouping;
        
        if (groups && groups.length > 0 && currentGrouping === 'phase') {
          // Find current group containing the task
          const currentGroup = groups.find(group => group.taskIds.includes(taskId));
          
          // Find target group based on new phase value
          let targetGroup: any = null;
          
          if (newPhaseValue) {
            // Find group by phase name
            targetGroup = groups.find(group => 
              group.groupValue === newPhaseValue || group.title === newPhaseValue
            );
          } else {
            // Find "No Phase" or similar group
            targetGroup = groups.find(group => 
              group.groupValue === '' || group.title.toLowerCase().includes('no phase') || group.title.toLowerCase().includes('unassigned')
            );
          }
          
          if (currentGroup && targetGroup && currentGroup.id !== targetGroup.id) {
            console.log('🔄 Moving task between phase groups:', {
              taskId: taskId,
              fromGroup: currentGroup.title,
              toGroup: targetGroup.title,
              newPhase: newPhaseValue || 'No Phase'
            });
            
            dispatch(moveTaskBetweenGroups({
              taskId: taskId,
              fromGroupId: currentGroup.id,
              toGroupId: targetGroup.id,
              taskUpdate: {
                phase: newPhaseValue,
              }
            }));
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
    (task: {
      id: string;
      parent_task: string | null;
      start_date: string;
    }) => {
      if (!task) return;

      const taskWithProgress = {
        ...task,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskStartDate({ task: taskWithProgress }));
      dispatch(setStartDate(taskWithProgress));
    },
    [dispatch]
  );

  const handleTaskSubscribersChange = useCallback(
    (data: InlineMember[]) => {
      if (!data) return;
      dispatch(setTaskSubscribers(data));
    },
    [dispatch]
  );

  const handleEstimationChange = useCallback(
    (task: {
      id: string;
      parent_task: string | null;
      estimation: number;
    }) => {
      if (!task) return;

      const taskWithProgress = {
        ...task,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskEstimation({ task: taskWithProgress }));
    },
    [dispatch]
  );

  const handleTaskDescriptionChange = useCallback(
    (data: {
      id: string;
      parent_task: string;
      description: string;
    }) => {
      if (!data) return;
      dispatch(updateTaskDescription(data));
    },
    [dispatch]
  );

  const handleNewTaskReceived = useCallback(
    (data: IProjectTask) => {
      if (!data) return;
      if (data.parent_task_id) {
        // Handle subtask creation
        dispatch(updateSubTasks(data));
      } else {
        // Handle regular task creation - transform to Task format and add
        const task = {
          id: data.id || '',
          task_key: data.task_key || '',
          title: data.name || '',
          description: data.description || '',
          status: (data.status_category?.is_todo ? 'todo' : 
                   data.status_category?.is_doing ? 'doing' : 
                   data.status_category?.is_done ? 'done' : 'todo') as 'todo' | 'doing' | 'done',
          priority: (data.priority_value === 3 ? 'critical' :
                     data.priority_value === 2 ? 'high' :
                     data.priority_value === 1 ? 'medium' : 'low') as 'critical' | 'high' | 'medium' | 'low',
          phase: data.phase_name || 'Development',
          progress: data.complete_ratio || 0,
          assignees: data.assignees?.map(a => a.team_member_id) || [],
          assignee_names: data.names || [],
          labels: data.labels?.map(l => ({
            id: l.id || '',
            name: l.name || '',
            color: l.color_code || '#1890ff',
            end: l.end,
            names: l.names
          })) || [],
          dueDate: data.end_date,
          timeTracking: {
            estimated: (data.total_hours || 0) + ((data.total_minutes || 0) / 60),
            logged: ((data.time_spent?.hours || 0) + ((data.time_spent?.minutes || 0) / 60)),
          },
          customFields: {},
          createdAt: data.created_at || new Date().toISOString(),
          updatedAt: data.updated_at || new Date().toISOString(),
          order: data.sort_order || 0,
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
          // For phase grouping, use phase_id
          groupId = data.phase_id;
        }
        
        // Use addTaskToGroup with the actual group UUID
        dispatch(addTaskToGroup({ task, groupId }));
      }
    },
    [dispatch]
  );

  const handleTaskProgressUpdated = useCallback(
    (data: {
      task_id: string;
      progress_value?: number;
      weight?: number;
    }) => {
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

  // Register socket event listeners
  useEffect(() => {
    if (!socket) return;

    const eventHandlers = [
      { event: SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handler: handleAssigneesUpdate },
      { event: SocketEvents.TASK_LABELS_CHANGE.toString(), handler: handleLabelsChange },
      { event: SocketEvents.TASK_STATUS_CHANGE.toString(), handler: handleTaskStatusChange },
      { event: SocketEvents.TASK_PROGRESS_UPDATED.toString(), handler: handleTaskProgress },
      { event: SocketEvents.TASK_PRIORITY_CHANGE.toString(), handler: handlePriorityChange },
      { event: SocketEvents.TASK_END_DATE_CHANGE.toString(), handler: handleEndDateChange },
      { event: SocketEvents.TASK_NAME_CHANGE.toString(), handler: handleTaskNameChange },
      { event: SocketEvents.TASK_PHASE_CHANGE.toString(), handler: handlePhaseChange },
      { event: SocketEvents.TASK_START_DATE_CHANGE.toString(), handler: handleStartDateChange },
      { event: SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), handler: handleTaskSubscribersChange },
      { event: SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), handler: handleEstimationChange },
      { event: SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), handler: handleTaskDescriptionChange },
      { event: SocketEvents.QUICK_TASK.toString(), handler: handleNewTaskReceived },
      { event: SocketEvents.TASK_PROGRESS_UPDATED.toString(), handler: handleTaskProgressUpdated },
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
  ]);
}; 