import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${API_BASE_URL}/story-points`;

export const storyPointsApiService = {
  updateScale: async (projectId: string, scale: number[]) => {
    const response = await apiClient.put<
      IServerResponse<{ id: string; story_point_scale: number[] }>
    >(`${rootUrl}/scale`, { project_id: projectId, scale });
    return response.data;
  },

  setTaskPoints: async (projectId: string, taskId: string, storyPoints: number | null) => {
    const response = await apiClient.put<
      IServerResponse<{ id: string; story_points: number | null }>
    >(`${rootUrl}/tasks/${taskId}`, { project_id: projectId, story_points: storyPoints });
    return response.data;
  },
};
