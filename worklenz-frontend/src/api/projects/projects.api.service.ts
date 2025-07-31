import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IProjectOverviewStats, IProjectsViewModel } from '@/types/project/projectsViewModel.types';
import { toQueryString } from '@/utils/toQueryString';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberOverviewGetResponse } from '@/types/project/project-insights.types';
import { IProjectMembersViewModel } from '@/types/projectMember.types';
import { IProjectManager } from '@/types/project/projectManager.types';
import { IGroupedProjectsViewModel } from '@/types/project/groupedProjectsViewModel.types';

const rootUrl = `${API_BASE_URL}/projects`;

interface UpdateProjectPayload {
  id: string;
  [key: string]: any;
}

export const projectsApiService = {
  getProjects: async (
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search: string | null,
    filter: number | null = null,
    statuses: string | null = null,
    categories: string | null = null
  ): Promise<IServerResponse<IProjectsViewModel>> => {
    const s = encodeURIComponent(search || '');
    const url = `${rootUrl}${toQueryString({ index, size, field, order, search: s, filter, statuses, categories })}`;
    const response = await apiClient.get<IServerResponse<IProjectsViewModel>>(`${url}`);
    return response.data;
  },

  getGroupedProjects: async (
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search: string | null,
    groupBy: string,
    filter: number | null = null,
    statuses: string | null = null,
    categories: string | null = null
  ): Promise<IServerResponse<IGroupedProjectsViewModel>> => {
    const s = encodeURIComponent(search || '');
    const url = `${rootUrl}/grouped${toQueryString({ index, size, field, order, search: s, groupBy, filter, statuses, categories })}`;
    const response = await apiClient.get<IServerResponse<IGroupedProjectsViewModel>>(`${url}`);
    return response.data;
  },

  getProject: async (id: string): Promise<IServerResponse<IProjectViewModel>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.get<IServerResponse<IProjectViewModel>>(`${url}`);
    return response.data;
  },

  toggleFavoriteProject: async (id: string): Promise<IServerResponse<IProjectsViewModel>> => {
    const url = `${rootUrl}/favorite/${id}`;
    const response = await apiClient.get<IServerResponse<IProjectsViewModel>>(`${url}`);
    return response.data;
  },

  getOverViewById: async (id: string): Promise<IServerResponse<IProjectOverviewStats>> => {
    const url = `${rootUrl}/overview/${id}`;
    const response = await apiClient.get<IServerResponse<IProjectOverviewStats>>(`${url}`);
    return response.data;
  },

  getOverViewMembersById: async (
    id: string,
    archived = false
  ): Promise<IServerResponse<ITeamMemberOverviewGetResponse[]>> => {
    const url = `${rootUrl}/overview-members/${id}?archived=${archived}`;
    const response = await apiClient.get<IServerResponse<ITeamMemberOverviewGetResponse[]>>(
      `${url}`
    );
    return response.data;
  },

  getMembers: async (
    id: string,
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search: string | null
  ): Promise<IServerResponse<IProjectMembersViewModel>> => {
    const s = encodeURIComponent(search || '');
    const url = `${rootUrl}/members/${id}${toQueryString({ index, size, field, order, search: s })}`;
    const response = await apiClient.get<IServerResponse<IProjectMembersViewModel>>(`${url}`);
    return response.data;
  },

  createProject: async (
    project: IProjectViewModel
  ): Promise<IServerResponse<IProjectViewModel>> => {
    const url = `${rootUrl}`;
    const response = await apiClient.post<IServerResponse<IProjectViewModel>>(`${url}`, project);
    return response.data;
  },

  updateProject: async (
    payload: UpdateProjectPayload
  ): Promise<IServerResponse<IProjectViewModel>> => {
    const { id, ...data } = payload;
    const q = toQueryString({ current_project_id: id });
    const url = `${API_BASE_URL}/projects/${id}${q}`;
    const response = await apiClient.patch<IServerResponse<IProjectViewModel>>(url, data);
    return response.data;
  },

  deleteProject: async (id: string): Promise<IServerResponse<IProjectViewModel>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.delete<IServerResponse<IProjectViewModel>>(`${url}`);
    return response.data;
  },

  toggleArchiveProject: async (id: string): Promise<IServerResponse<any>> => {
    const url = `${rootUrl}/archive/${id}`;
    const response = await apiClient.get<IServerResponse<IProjectViewModel>>(`${url}`);
    return response.data;
  },

  toggleArchiveProjectForAll: async (id: string): Promise<IServerResponse<any>> => {
    const url = `${rootUrl}/archive-all/${id}`;
    const response = await apiClient.get<IServerResponse<IProjectViewModel>>(`${url}`);
    return response.data;
  },

  updateDefaultTab: async (body: {
    project_id: string;
    default_view: string;
  }): Promise<IServerResponse<any>> => {
    const url = `${rootUrl}/update-pinned-view`;
    const response = await apiClient.put<IServerResponse<IProjectViewModel>>(`${url}`, body);
    return response.data;
  },

  getProjectManagers: async (): Promise<IServerResponse<IProjectManager[]>> => {
    const url = `${API_BASE_URL}/project-managers`;
    const response = await apiClient.get<IServerResponse<IProjectManager[]>>(`${url}`);
    return response.data;
  },
};
