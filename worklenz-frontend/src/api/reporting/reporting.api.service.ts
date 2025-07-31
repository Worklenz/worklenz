import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import {
  IProjectLogsBreakdown,
  IRPTMember,
  IRPTOverviewMemberInfo,
  IRPTOverviewProjectInfo,
  IRPTOverviewProjectMember,
  IRPTOverviewStatistics,
  IRPTOverviewTeamInfo,
  IRPTProject,
  IRPTProjectsViewModel,
  IRPTReportingMemberTask,
  IRPTTeam,
  ITimeLogBreakdownReq,
} from '@/types/reporting/reporting.types';
import { IReportingInfo } from '@/types/reporting/reporting.types';
import {
  IMemberProjectsResonse,
  IMemberTaskStatGroupResonse,
  IRPTMemberProject,
  IRPTMemberResponse,
  IRPTTimeMember,
  IRPTTimeProject,
  ISingleMemberActivityLogs,
  ISingleMemberLogs,
} from '@/types/reporting/reporting.types';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import {
  ISelectableCategory,
  ISelectableProject,
} from '../../types/reporting/reporting-filters.types';
import { IAllocationViewModel } from '@/types/reporting/reporting-allocation.types';

const rootUrl = `${API_BASE_URL}/reporting`;

export const reportingApiService = {
  getProject: async (id: string): Promise<IServerResponse<IProjectViewModel>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.get<IServerResponse<IProjectViewModel>>(`${url}`);
    return response.data;
  },

  getInfo: async (): Promise<IServerResponse<IReportingInfo>> => {
    const url = `${rootUrl}/info`;
    const response = await apiClient.get<IServerResponse<IReportingInfo>>(url);
    return response.data;
  },

  getOverviewStatistics: async (
    includeArchived = false
  ): Promise<IServerResponse<IRPTOverviewStatistics>> => {
    const q = toQueryString({ archived: includeArchived });
    const url = `${rootUrl}/overview/statistics${q}`;
    const response = await apiClient.get<IServerResponse<IRPTOverviewStatistics>>(url);
    return response.data;
  },

  getOverviewTeams: async (includeArchived = true): Promise<IServerResponse<IRPTTeam[]>> => {
    const q = toQueryString({ archived: includeArchived });
    const url = `${rootUrl}/overview/teams${q}`;
    const response = await apiClient.get<IServerResponse<IRPTTeam[]>>(url);
    return response.data;
  },

  getOverviewProjects: async (
    body: any | null = null
  ): Promise<IServerResponse<IRPTProjectsViewModel>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}/overview/projects${q}`;
    const response = await apiClient.get<IServerResponse<IRPTProjectsViewModel>>(url);
    return response.data;
  },

  getOverviewProjectsByTeam: async (
    teamId: string,
    teamMemberId?: string
  ): Promise<IServerResponse<IRPTProject[]>> => {
    const q = toQueryString({ member: teamMemberId || null });
    const url = `${rootUrl}/overview/projects/${teamId}${q}`;
    const response = await apiClient.get<IServerResponse<IRPTProject[]>>(url);
    return response.data;
  },

  getOverviewMembersByTeam: async (
    teamId: string,
    archived: boolean
  ): Promise<IServerResponse<IRPTMember[]>> => {
    const q = toQueryString({ archived });
    const url = `${rootUrl}/overview/members/${teamId}${q}`;
    const response = await apiClient.get<IServerResponse<IRPTMember[]>>(url);
    return response.data;
  },

  getTeamInfo: async (
    teamId: string,
    archived = false
  ): Promise<IServerResponse<IRPTOverviewTeamInfo>> => {
    const q = toQueryString({ archived });
    const url = `${rootUrl}/overview/team/info/${teamId}${q}`;
    const response = await apiClient.get<IServerResponse<IRPTOverviewTeamInfo>>(url);
    return response.data;
  },

  getProjectInfo: async (projectId: string): Promise<IServerResponse<IRPTOverviewProjectInfo>> => {
    const url = `${rootUrl}/overview/project/info/${projectId}`;
    const response = await apiClient.get<IServerResponse<IRPTOverviewProjectInfo>>(url);
    return response.data;
  },

  getMemberInfo: async (
    body: any | null = null
  ): Promise<IServerResponse<IRPTOverviewMemberInfo>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}/overview/member/info/${q}`;
    const response = await apiClient.get<IServerResponse<IRPTOverviewMemberInfo>>(url);
    return response.data;
  },

  getTeamMemberInfo: async (
    body: any | null = null
  ): Promise<IServerResponse<IRPTOverviewMemberInfo>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}/overview/team-member/info/${q}`;
    const response = await apiClient.get<IServerResponse<IRPTOverviewMemberInfo>>(url);
    return response.data;
  },

  getProjectMembers: async (
    projectId: string
  ): Promise<IServerResponse<IRPTOverviewProjectMember[]>> => {
    const url = `${rootUrl}/overview/project/members/${projectId}`;
    const response = await apiClient.get<IServerResponse<IRPTOverviewProjectMember[]>>(url);
    return response.data;
  },

  getTasks: async (
    projectId: string,
    groupBy: string
  ): Promise<IServerResponse<ITaskListGroup[]>> => {
    const q = toQueryString({ group: groupBy });
    const url = `${rootUrl}/overview/project/tasks/${projectId}${q}`;
    const response = await apiClient.get<IServerResponse<ITaskListGroup[]>>(url);
    return response.data;
  },

  getTasksByMember: async (
    teamMemberId: string,
    projectId: string | null = null,
    isMultiple: boolean,
    teamId: string | null = null,
    additionalBody: any | null = null
  ): Promise<IServerResponse<IRPTReportingMemberTask[]>> => {
    const q = toQueryString({
      project: projectId || null,
      is_multiple: isMultiple,
      teamId,
      only_single_member: additionalBody.only_single_member,
      duration: additionalBody.duration,
      date_range: additionalBody.date_range,
      archived: additionalBody.archived,
    });
    const url = `${rootUrl}/overview/member/tasks/${teamMemberId}${q}`;
    const response = await apiClient.get<IServerResponse<IRPTReportingMemberTask[]>>(url);
    return response.data;
  },

  getProjects: async (body: any | null = null): Promise<IServerResponse<IRPTProjectsViewModel>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}/projects${q}`;
    const response = await apiClient.get<IServerResponse<IRPTProjectsViewModel>>(url);
    return response.data;
  },

  getProjectTimeLogs: async (
    body: ITimeLogBreakdownReq
  ): Promise<IServerResponse<IProjectLogsBreakdown[]>> => {
    const url = `${rootUrl}/project-timelogs`;
    const response = await apiClient.post<IServerResponse<IProjectLogsBreakdown[]>>(url, body);
    return response.data;
  },

  getCategories: async (
    selectedTeams: string[]
  ): Promise<IServerResponse<ISelectableCategory[]>> => {
    const url = `${rootUrl}/allocation/categories`;
    const response = await apiClient.post<IServerResponse<ISelectableCategory[]>>(
      url,
      selectedTeams
    );
    return response.data;
  },

  getAllocationProjects: async (
    selectedTeams: string[],
    categories: string[],
    isNoCategory: boolean
  ): Promise<IServerResponse<ISelectableProject[]>> => {
    const body = {
      selectedTeams: selectedTeams,
      selectedCategories: categories,
      noCategoryIncluded: isNoCategory,
    };
    const url = `${rootUrl}/allocation/projects`;
    const response = await apiClient.post<IServerResponse<ISelectableProject[]>>(url, body);
    return response.data;
  },

  getAllocationData: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IAllocationViewModel>> => {
    const q = toQueryString({ archived });
    const url = `${rootUrl}/allocation${q}`;
    const response = await apiClient.post<IServerResponse<IAllocationViewModel>>(url, body);
    return response.data;
  },

  getMembers: async (body: any | null = null): Promise<IServerResponse<IRPTMemberResponse>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}/members${q}`;
    const response = await apiClient.get<IServerResponse<IRPTMemberResponse>>(url);
    return response.data;
  },

  getMemberProjects: async (
    body: any | null = null
  ): Promise<IServerResponse<IRPTMemberProject[]>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}/member-projects${q}`;
    const response = await apiClient.get<IServerResponse<IRPTMemberProject[]>>(url);
    return response.data;
  },

  getProjectTimeSheets: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeProject[]>> => {
    const q = toQueryString({ archived });
    const url = `${rootUrl}/time-reports/projects${q}`;
    const response = await apiClient.post<IServerResponse<IRPTTimeProject[]>>(url, body);
    return response.data;
  },

  getProjectEstimatedVsActual: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeProject[]>> => {
    const q = toQueryString({ archived });
    const url = `${rootUrl}/time-reports/estimated-vs-actual${q}`;
    const response = await apiClient.post<IServerResponse<IRPTTimeProject[]>>(url, body);
    return response.data;
  },

  getMemberTimeSheets: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeMember[]>> => {
    const q = toQueryString({ archived });
    const url = `${rootUrl}/time-reports/members${q}`;
    const response = await apiClient.post<IServerResponse<IRPTTimeMember[]>>(url, body);
    return response.data;
  },

  getSingleMemberActivities: async (
    body: any | null = null
  ): Promise<IServerResponse<ISingleMemberActivityLogs[]>> => {
    const url = `${rootUrl}/members/single-member-activities`;
    const response = await apiClient.post<IServerResponse<ISingleMemberActivityLogs[]>>(url, body);
    return response.data;
  },

  getSingleMemberTimeLogs: async (
    body: any | null = null
  ): Promise<IServerResponse<ISingleMemberLogs[]>> => {
    const url = `${rootUrl}/members/single-member-timelogs`;
    const response = await apiClient.post<IServerResponse<ISingleMemberLogs[]>>(url, body);
    return response.data;
  },

  getMemberTasksStats: async (
    body: any | null = null
  ): Promise<IServerResponse<IMemberTaskStatGroupResonse>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}/members/single-member-task-stats${q}`;
    const response = await apiClient.get<IServerResponse<IMemberTaskStatGroupResonse>>(url);
    return response.data;
  },

  getSingleMemberProjects: async (
    body: any | null = null
  ): Promise<IServerResponse<IMemberProjectsResonse>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}/members/single-member-projects${q}`;
    const response = await apiClient.get<IServerResponse<IMemberProjectsResonse>>(url);
    return response.data;
  },
};
