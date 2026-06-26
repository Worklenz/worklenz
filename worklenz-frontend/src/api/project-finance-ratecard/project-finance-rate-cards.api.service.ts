import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IJobType, JobRoleType } from '@/types/project/ratecard.types';

const rootUrl = `${API_BASE_URL}/project-ratecard`;

export interface IProjectRateCardRole {
  id?: string;
  project_id: string;
  job_title_id: string;
  jobtitle?: string;
  rate: number;
  man_day_rate?: number;
  data?: object;
  roles?: IJobType[];
}

export const projectRateCardApiService = {
  // Insert multiple roles for a project
  async insertMany(
    project_id: string,
    roles: Omit<IProjectRateCardRole, 'id' | 'project_id'>[]
  ): Promise<IServerResponse<IProjectRateCardRole[]>> {
    const response = await apiClient.post<IServerResponse<IProjectRateCardRole[]>>(rootUrl, {
      project_id,
      roles,
    });
    return response.data;
  },
  // Insert a single role for a project
  async insertOne({
    project_id,
    job_title_id,
    rate,
    man_day_rate,
  }: {
    project_id: string;
    job_title_id: string;
    rate: number;
    man_day_rate?: number;
  }): Promise<IServerResponse<IProjectRateCardRole>> {
    const response = await apiClient.post<IServerResponse<IProjectRateCardRole>>(
      `${rootUrl}/create-project-rate-card-role`,
      { project_id, job_title_id, rate, man_day_rate }
    );
    return response.data;
  },

  // Get all roles for a project
  async getFromProjectId(project_id: string): Promise<IServerResponse<IProjectRateCardRole[]>> {
    const response = await apiClient.get<IServerResponse<IProjectRateCardRole[]>>(
      `${rootUrl}/project/${project_id}`
    );
    return response.data;
  },

  // Get a single role by id
  async getFromId(id: string): Promise<IServerResponse<IProjectRateCardRole>> {
    const response = await apiClient.get<IServerResponse<IProjectRateCardRole>>(`${rootUrl}/${id}`);
    return response.data;
  },

  // Update a single role by id
  async updateFromId(
    id: string,
    body: { job_title_id: string; rate?: string; man_day_rate?: string }
  ): Promise<IServerResponse<IProjectRateCardRole>> {
    const response = await apiClient.put<IServerResponse<IProjectRateCardRole>>(
      `${rootUrl}/${id}`,
      body
    );
    return response.data;
  },

  // Update all roles for a project (delete then insert)
  async updateFromProjectId(
    project_id: string,
    roles: Omit<IProjectRateCardRole, 'id' | 'project_id'>[]
  ): Promise<IServerResponse<IProjectRateCardRole[]>> {
    const response = await apiClient.put<IServerResponse<IProjectRateCardRole[]>>(
      `${rootUrl}/project/${project_id}`,
      { project_id, roles }
    );
    return response.data;
  },

  // Update project member rate card role
  async updateMemberRateCardRole(
    project_id: string,
    member_id: string,
    project_rate_card_role_id: string
  ): Promise<IServerResponse<JobRoleType>> {
    const response = await apiClient.put<IServerResponse<JobRoleType>>(
      `${rootUrl}/project/${project_id}/members/${member_id}/rate-card-role`,
      { project_rate_card_role_id }
    );
    return response.data;
  },

  // Delete a single role by id
  async deleteFromId(id: string): Promise<IServerResponse<IProjectRateCardRole>> {
    const response = await apiClient.delete<IServerResponse<IProjectRateCardRole>>(
      `${rootUrl}/${id}`
    );
    return response.data;
  },

  // Delete all roles for a project
  async deleteFromProjectId(project_id: string): Promise<IServerResponse<IProjectRateCardRole[]>> {
    const response = await apiClient.delete<IServerResponse<IProjectRateCardRole[]>>(
      `${rootUrl}/project/${project_id}`
    );
    return response.data;
  },
};
