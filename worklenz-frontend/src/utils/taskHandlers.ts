import { Dispatch } from '@reduxjs/toolkit';
import { store } from '@/app/store';
import { Task } from '@/types/task-management.types';
import {
  addTaskToGroup,
  addSubtaskToParent,
  removeTemporarySubtask,
} from '@/features/task-management/task-management.slice';
import {
  updateEnhancedKanbanSubtask,
  addTaskToGroup as addEnhancedKanbanTaskToGroup,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface HandleNewTaskReceivedOptions {
  dispatch: Dispatch;
  currentGroupingV3: string | null;
  enhancedKanbanGroupBy?: string | null; // Add kanban grouping
  trackEvent?: (eventName: string, properties: any) => void;
  subtaskEventName?: string;
  taskEventName?: string;
}

/**
 * Shared handler for processing new task data received from API or Socket.IO
 * Handles both subtask and regular task creation
 * Updates both task-management slice (task list) and enhanced kanban slice independently
 */
export const handleNewTaskReceived = (response: any, options: HandleNewTaskReceivedOptions) => {
  const {
    dispatch,
    currentGroupingV3,
    enhancedKanbanGroupBy,
    trackEvent,
    subtaskEventName,
    taskEventName,
  } = options;

  // Handle array format response [index, taskData]
  const data = Array.isArray(response) ? response[1] : response;
  if (!data) return;
  const taskName = decodeHtmlEntities(data.name || data.title);

  // Helper to construct assignee_names from assignees array if names is not available
  const getAssigneeNames = (assignees: any[], names: any[]) => {
    if (names && names.length > 0) return names;
    if (!assignees || assignees.length === 0) return [];
    // Construct names array from assignees
    return assignees.map((a: any) => ({
      team_member_id: a.team_member_id,
      name: a.name || '',
      user_id: a.user_id,
      avatar_url: a.avatar_url || '',
      email: a.email || '',
    }));
  };

  if (data.parent_task_id) {
    // Handle subtask creation
    const subtask: Task = {
      id: data.id || '',
      task_key: data.task_key || '',
      title: taskName,
      name: taskName,
      description: data.description || '',
      // Prefer canonical status ID if provided; otherwise fall back to category value
      status: (data.status ||
        (data.status_category?.is_todo
          ? 'todo'
          : data.status_category?.is_doing
            ? 'doing'
            : data.status_category?.is_done
              ? 'done'
              : 'todo')) as string,
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
      assignee_names: getAssigneeNames(data.assignees || [], data.names || []),
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
      custom_column_values: data.custom_column_values || {},
      comments_count: data.comments_count || 0,
      attachments_count: data.attachments_count || 0,
      has_subscribers: data.has_subscribers || false,
      has_dependencies: data.has_dependencies || false,
      reporter: data.reporter || '',
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

    // Track subtask creation event if tracking is enabled
    if (trackEvent && subtaskEventName) {
      trackEvent(subtaskEventName, {
        task_id: data.id,
        project_id: data.project_id,
        parent_task_id: data.parent_task_id,
      });
    }

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
      title: taskName,
      name: taskName,
      description: data.description || '',
      // Prefer concrete status id if provided; fall back to category only if missing
      status: (data.status ||
        data.status_id ||
        (data.status_category?.is_todo
          ? 'todo'
          : data.status_category?.is_doing
            ? 'doing'
            : data.status_category?.is_done
              ? 'done'
              : 'todo')) as any,
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
      assignee_names: getAssigneeNames(data.assignees || [], data.names || []),
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
      sub_tasks_count: data.sub_tasks_count || 0,
      show_sub_tasks: false,
      custom_column_values: data.custom_column_values || {},
      comments_count: data.comments_count || 0,
      attachments_count: data.attachments_count || 0,
      has_subscribers: data.has_subscribers || false,
      has_dependencies: data.has_dependencies || false,
      reporter: data.reporter || '',
    };

    // Helper function to determine group ID based on grouping type
    const getGroupIdForGrouping = (groupingType: string | null) => {
      const grouping = groupingType || 'status';
      let groupId: string | undefined;

      if (grouping === 'status') {
        groupId = data.status;
      } else if (grouping === 'priority') {
        groupId = data.priority_id || data.priority || 'Unmapped';

        if (!groupId || groupId === 'Unmapped') {
          const state = store.getState();
          const priorityList = state.priorityReducer?.priorities || [];
          const priorityValue = data.priority_value;

          if (priorityValue !== undefined && priorityValue !== null) {
            const matchedPriority = priorityList.find((p: any) => p.value === priorityValue);
            if (matchedPriority) {
              groupId = matchedPriority.id;
            }
          }
        }
      } else if (grouping === 'phase') {
        groupId = data.phase_id;

        if (!groupId || groupId === 'Unmapped') {
          const state = store.getState();
          const phaseList = state.phaseReducer?.phaseList || [];
          const phaseName = data.phase_name;

          if (phaseName) {
            const matchedPhase = phaseList.find((p: any) => p.name === phaseName);
            if (matchedPhase) {
              groupId = matchedPhase.id;
            } else {
              groupId = 'Unmapped';
            }
          } else {
            groupId = 'Unmapped';
          }
        }
      }

      return groupId || '';
    };

    // Update task-management slice (for task list) with its own grouping
    const taskListGroupId = getGroupIdForGrouping(currentGroupingV3);
    dispatch(addTaskToGroup({ task, groupId: taskListGroupId }));

    // Update enhanced kanban slice with its own grouping (if provided)
    const kanbanGroupId = getGroupIdForGrouping(enhancedKanbanGroupBy || currentGroupingV3);
    dispatch(
      addEnhancedKanbanTaskToGroup({
        sectionId: kanbanGroupId,
        task: data,
      })
    );

    // Track regular task creation event if tracking is enabled
    if (trackEvent && taskEventName) {
      trackEvent(taskEventName, {
        task_id: data.id,
        project_id: data.project_id,
      });
    }
  }
};
