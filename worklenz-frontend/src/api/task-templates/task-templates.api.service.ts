import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import {
  ITaskTemplateGetResponse,
  ITaskTemplatesGetResponse,
  ITaskTemplateTask,
} from '@/types/settings/task-templates.types';
import { ITask } from '@/types/tasks/task.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const rootUrl = `${API_BASE_URL}/task-templates`;

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
      id: task.id,
      name: task.name || '',
      total_minutes: task.total_minutes ?? 0,
    };

    if (includeSubtasks && task.sub_tasks && task.sub_tasks.length > 0) {
      templateTask.sub_tasks = task.sub_tasks.map(subtask => {
        const subtaskEntry = {
          id: subtask.id,
          name: subtask.name || '',
          total_minutes: subtask.total_minutes ?? 0,
          // Level-3: include grandchildren if present
          ...(subtask.sub_tasks && subtask.sub_tasks.length > 0
            ? {
                sub_tasks: subtask.sub_tasks.map(grandchild => ({
                  id: grandchild.id,
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

  /** One-click duplicate ("Copy of …"). */
  duplicateTemplate: async (
    id: string
  ): Promise<IServerResponse<{ id: string; name: string }>> => {
    const response = await apiClient.post<IServerResponse<{ id: string; name: string }>>(
      `${rootUrl}/${id}/duplicate`
    );
    return response.data;
  },

  updateTemplateScope: async (
    id: string,
    scope: 'team' | 'organization'
  ): Promise<IServerResponse<{ id: string; scope: string }>> => {
    const response = await apiClient.patch<IServerResponse<{ id: string; scope: string }>>(
      `${rootUrl}/${id}/scope`,
      { scope },
      { headers: { 'X-Silent-Request': '1' } }
    );
    return response.data;
  },

  /**
   * Import tasks from a template into a project.
   * Sends the nested ITaskTemplateTask[] (up to 3 levels) as-is; the DB function
   * walks the sub_tasks nesting directly, so parent/child links never depend on
   * name matching.
   */
  importTemplate: async (
    id: string,
    templateId: string,
    tasks: ITaskTemplateTask[]
  ): Promise<IServerResponse<ITask>> => {
    const url = `${rootUrl}/import/${id}?templateId=${templateId}`;
    const response = await apiClient.post<IServerResponse<ITask>>(url, tasks);
    return response.data;
  },
};
