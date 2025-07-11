import { IServerResponse } from '@/types/common.types';
import {
  IGetProjectsRequestBody,
  IRPTMembersViewModel,
  IRPTOverviewProjectMember,
  IRPTProjectsViewModel,
} from '@/types/reporting/reporting.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/reporting/members`;

export const reportingMembersApiService = {
  getMembers: async (body: any): Promise<IServerResponse<IRPTMembersViewModel>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}${q}`;
    const response = await apiClient.get<IServerResponse<IRPTMembersViewModel>>(url);
    return response.data;
  },
};
