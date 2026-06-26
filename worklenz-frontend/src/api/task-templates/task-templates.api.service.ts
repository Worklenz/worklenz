import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import {
  ITaskTemplateGetResponse,
  ITaskTemplateImportRow,
  ITaskTemplatesGetResponse,
  ITaskTemplateTask,
} from '@/types/settings/task-templates.types';
import { ITask } from '@/types/tasks/task.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const rootUrl = `${API_BASE_URL}/task-templates`;

/**
 * Flattens a nested ITaskTemplateTask[] (up to 3 levels deep) into a flat
 * ITaskTemplateImportRow[] that the import_tasks_from_template DB function understands.
 *
 * Level 1 (parent tasks):   parent_task_name = null
 * Level 2 (subtasks):       parent_task_name = parent task name
 * Level 3 (sub-subtasks):   parent_task_name = level-2 subtask name
 *
 * The DB function resolves parent UUIDs by name in insertion order, so the flat
 * array must list parents before their children at every level.
 */
function flattenTasksForImport(tasks: ITaskTemplateTask[]): ITaskTemplateImportRow[] {
  const rows: ITaskTemplateImportRow[] = [];

  for (const task of tasks) {
    // Level 1 — parent task
    rows.push({
      name: task.name,
      total_minutes: task.total_minutes ?? 0,
      parent_task_name: null,
    });

    if (task.sub_tasks && task.sub_tasks.length > 0) {
      for (const subtask of task.sub_tasks) {
        // Level 2 — subtask of parent
        rows.push({
          name: subtask.name,
          total_minutes: subtask.total_minutes ?? 0,
          parent_task_name: task.name,
        });

        // Level 3 — sub-subtask of subtask
        if (subtask.sub_tasks && subtask.sub_tasks.length > 0) {
          for (const grandchild of subtask.sub_tasks) {
            rows.push({
              name: grandchild.name,
              total_minutes: grandchild.total_minutes ?? 0,
              parent_task_name: subtask.name,
            });
          }
        }
      }
    }
  }

  return rows;
}

/**
 * Converts IProjectTask[] (from Redux task management state) into the
 * ITaskTemplateTask[] format expected by the create/update template API.
 *
 * When includeSubtasks is true, carries sub_tasks up to 3 levels deep.
 * Level-2 subtasks (sub_tasks on each subtask) are included when present.
 */
export function buildTemplateTasksPayload(
  projectTasks: IProjectTask[],
  includeSubtasks: boolean
): ITaskTemplateTask[] {
  return projectTasks.map(task => {
    const templateTask: ITaskTemplateTask = {
      name: task.name || '',
      total_minutes: task.total_minutes ?? 0,
    };

    if (includeSubtasks && task.sub_tasks && task.sub_tasks.length > 0) {
      templateTask.sub_tasks = task.sub_tasks.map(subtask => {
        const subtaskEntry = {
          name: subtask.name || '',
          total_minutes: subtask.total_minutes ?? 0,
          // Level-3: include grandchildren if present
          ...(subtask.sub_tasks && subtask.sub_tasks.length > 0
            ? {
                sub_tasks: subtask.sub_tasks.map(grandchild => ({
                  name: grandchild.name || '',
                  total_minutes: grandchild.total_minutes ?? 0,
                })),
              }
            : {}),
        };
        return subtaskEntry;
      });
    }

    return templateTask;
  });
}

export const taskTemplatesApiService = {
  getTemplates: async (): Promise<IServerResponse<ITaskTemplatesGetResponse[]>> => {
    const response = await apiClient.get<IServerResponse<ITaskTemplatesGetResponse[]>>(rootUrl);
    return response.data;
  },

  getTemplate: async (id: string): Promise<IServerResponse<ITaskTemplateGetResponse>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.get<IServerResponse<ITaskTemplateGetResponse>>(url);
    return response.data;
  },

  createTemplate: async (body: {
    name: string;
    tasks: ITaskTemplateTask[];
  }): Promise<IServerResponse<ITask>> => {
    const response = await apiClient.post<IServerResponse<ITask>>(rootUrl, body);
    return response.data;
  },

  updateTemplate: async (
    id: string,
    body: { name: string; tasks: ITaskTemplateTask[] }
  ): Promise<IServerResponse<ITask>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.put<IServerResponse<ITask>>(url, body);
    return response.data;
  },

  deleteTemplate: async (id: string): Promise<IServerResponse<ITask>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.delete<IServerResponse<ITask>>(url);
    return response.data;
  },

  /**
   * Import tasks from a template into a project.
   * Accepts the nested ITaskTemplateTask[] (up to 3 levels) and flattens it
   * before sending so the DB function receives the correct flat format.
   */
  importTemplate: async (
    id: string,
    tasks: ITaskTemplateTask[]
  ): Promise<IServerResponse<ITask>> => {
    const url = `${rootUrl}/import/${id}`;
    const flatRows = flattenTasksForImport(tasks);
    const response = await apiClient.post<IServerResponse<ITask>>(url, flatRows);
    return response.data;
  },
};
