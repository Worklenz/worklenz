import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { ITask } from '@/types/tasks/task.types';
import {
  IBulkAssignMembersRequest,
  IBulkAssignRequest,
  IBulkTasksArchiveRequest,
  IBulkTasksDeleteRequest,
  IBulkTasksLabelsRequest,
  IBulkTasksPhaseChangeRequest,
  IBulkTasksPriorityChangeRequest,
  IBulkTasksStatusChangeRequest,
} from '@/types/tasks/bulk-action-bar.types';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';

const rootUrl = `${API_BASE_URL}/tasks/bulk`;

export const taskListBulkActionsApiService = {
  changeStatus: async (
    body: IBulkTasksStatusChangeRequest,
    projectId: string
  ): Promise<IServerResponse<{ failed_tasks: string[] }>> => {
    const response = await apiClient.put(`${rootUrl}/status?project=${projectId}`, body);
    return response.data;
  },
  changePriority: async (
    body: IBulkTasksPriorityChangeRequest,
    projectId: string
  ): Promise<IServerResponse<ITask>> => {
    const response = await apiClient.put(`${rootUrl}/priority?project=${projectId}`, body);
    return response.data;
  },
  changePhase: async (
    body: IBulkTasksPhaseChangeRequest,
    projectId: string
  ): Promise<IServerResponse<ITask>> => {
    const response = await apiClient.put(`${rootUrl}/phase?project=${projectId}`, body);
    return response.data;
  },
  deleteTasks: async (
    body: IBulkTasksDeleteRequest,
    projectId: string
  ): Promise<IServerResponse<ITask>> => {
    const response = await apiClient.put(`${rootUrl}/delete?project=${projectId}`, body);
    return response.data;
  },
  archiveTasks: async (
    body: IBulkTasksArchiveRequest,
    unarchive = false
  ): Promise<IServerResponse<ITask>> => {
    const response = await apiClient.put(
      `${rootUrl}/archive?type=${unarchive ? 'unarchive' : 'archive'}&project=${body.project_id}`,
      body
    );
    return response.data;
  },
  assignTasks: async (
    body: IBulkAssignMembersRequest
  ): Promise<IServerResponse<ITaskAssigneesUpdateResponse>> => {
    const response = await apiClient.put(`${rootUrl}/members?project=${body.project_id}`, body);
    return response.data;
  },
  assignToMe: async (
    body: IBulkAssignRequest
  ): Promise<IServerResponse<ITaskAssigneesUpdateResponse>> => {
    const response = await apiClient.put(`${rootUrl}/assign-me?project=${body.project_id}`, body);
    return response.data;
  },
  assignLabels: async (
    body: IBulkTasksLabelsRequest,
    projectId: string
  ): Promise<IServerResponse<ITask>> => {
    const response = await apiClient.put(`${rootUrl}/label?project=${projectId}`, body);
    return response.data;
  },
};
