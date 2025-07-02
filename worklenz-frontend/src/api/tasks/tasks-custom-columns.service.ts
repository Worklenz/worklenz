import { ITaskListColumn } from '@/types/tasks/taskList.types';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';

export const tasksCustomColumnsService = {
  getCustomColumns: async (projectId: string): Promise<IServerResponse<ITaskListColumn[]>> => {
    const response = await apiClient.get(`/api/v1/custom-columns/project/${projectId}/columns`);
    return response.data;
  },

  updateTaskCustomColumnValue: async (
    taskId: string,
    columnKey: string,
    value: string | number | boolean,
    projectId: string
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put(`/api/v1/tasks/${taskId}/custom-column`, {
      column_key: columnKey,
      value: value,
      project_id: projectId,
    });
    return response.data;
  },

  createCustomColumn: async (
    projectId: string,
    columnData: {
      name: string;
      key: string;
      field_type: string;
      width: number;
      is_visible: boolean;
      configuration: any;
    }
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.post('/api/v1/custom-columns', {
      project_id: projectId,
      ...columnData,
    });
    return response.data;
  },

  updateCustomColumn: async (
    columnId: string,
    columnData: {
      name: string;
      field_type: string;
      width: number;
      is_visible: boolean;
      configuration: any;
    }
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put(`/api/v1/custom-columns/${columnId}`, columnData);
    return response.data;
  },

  deleteCustomColumn: async (columnId: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.delete(`/api/v1/custom-columns/${columnId}`);
    return response.data;
  },

  updateCustomColumnVisibility: async (
    projectId: string,
    item: ITaskListColumn
  ): Promise<IServerResponse<ITaskListColumn>> => {
    const response = await apiClient.put(
      `/api/v1/custom-columns/project/${projectId}/columns`,
      item
    );
    return response.data;
  },
};
