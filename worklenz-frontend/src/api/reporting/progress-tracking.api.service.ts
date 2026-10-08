import { IServerResponse } from '@/types/common.types';
import {
  IProgressTrackingList,
  IProgressTrackingQuery,
  IDeliveryConfidenceDetails,
  IUpdateDeliveryConfidenceRequest,
  IUpdateDeliveryConfidenceResponse,
} from '@/types/reporting/progress-tracking.types';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';
import apiClient from '../api-client';

const rootUrl = `${API_BASE_URL}/reporting/progress-tracking`;
const projectConfidenceUrl = `${API_BASE_URL}/projects/delivery-confidence`;

export const progressTrackingApiService = {
  getProjects: async (
    query: IProgressTrackingQuery
  ): Promise<IServerResponse<IProgressTrackingList>> => {
    const params: Record<string, string | number | boolean> = {};
    if (query.search) params.search = query.search;
    if (query.confidence) params.confidence = query.confidence;
    if (query.percent_range) params.percent_range = query.percent_range;
    if (query.has_blockers) params.has_blockers = true;
    if (query.field) params.field = query.field;
    if (query.order) params.order = query.order;
    if (query.page) params.page = query.page;
    if (query.page_size) params.page_size = query.page_size;

    const response = await apiClient.get<IServerResponse<IProgressTrackingList>>(
      `${rootUrl}${toQueryString(params)}`
    );
    return response.data;
  },

  getConfidence: async (
    projectId: string
  ): Promise<IServerResponse<IDeliveryConfidenceDetails>> => {
    const response = await apiClient.get<IServerResponse<IDeliveryConfidenceDetails>>(
      `${projectConfidenceUrl}/${projectId}`
    );
    return response.data;
  },

  updateConfidence: async (
    projectId: string,
    body: IUpdateDeliveryConfidenceRequest
  ): Promise<IServerResponse<IUpdateDeliveryConfidenceResponse>> => {
    const response = await apiClient.patch<IServerResponse<IUpdateDeliveryConfidenceResponse>>(
      `${projectConfidenceUrl}/${projectId}`,
      body
    );
    return response.data;
  },
};
