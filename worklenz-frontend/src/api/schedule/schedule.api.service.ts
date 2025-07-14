import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import {
  DateList,
  Member,
  Project,
  ScheduleData,
  Settings,
} from '@/types/schedule/schedule-v2.types';

const rootUrl = `${API_BASE_URL}/schedule-gannt-v2`;

export const scheduleAPIService = {
  fetchScheduleSettings: async (): Promise<IServerResponse<Settings>> => {
    const response = await apiClient.get<IServerResponse<Settings>>(`${rootUrl}/settings`);
    return response.data;
  },

  updateScheduleSettings: async ({
    workingDays,
    workingHours,
  }: {
    workingDays: string[];
    workingHours: number;
  }): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/settings`, {
      workingDays,
      workingHours,
    });
    return response.data;
  },

  fetchScheduleDates: async ({
    type,
    date,
  }: {
    type: string;
    date: string;
  }): Promise<IServerResponse<DateList>> => {
    const response = await apiClient.get<IServerResponse<DateList>>(
      `${rootUrl}/dates/${date}/${type}`
    );
    return response.data;
  },

  fetchScheduleMembers: async (): Promise<IServerResponse<Member[]>> => {
    const response = await apiClient.get<IServerResponse<Member[]>>(`${rootUrl}/members`);
    return response.data;
  },

  fetchMemberProjects: async ({ id }: { id: string }): Promise<IServerResponse<Project>> => {
    const response = await apiClient.get<IServerResponse<Project>>(
      `${rootUrl}/members/projects/${id}`
    );
    return response.data;
  },

  submitScheduleData: async ({
    schedule,
  }: {
    schedule: ScheduleData;
  }): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/schedule`, schedule);
    return response.data;
  },
};
