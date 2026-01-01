import apiClient from './api-client';

export interface ImportJob {
  id: string;
  provider: string;
  flow_type: 'direct' | 'csv';
}

export const createImportJob = async (payload: {
  provider: string;
  flowType: 'direct' | 'csv';
  targetProjectId?: string | null;
  targetSpaceType?: string | null;
  targetTemplate?: string | null;
  sourceReference?: Record<string, unknown> | null;
}) => {
  const { data } = await apiClient.post('/api/imports', payload);
  return data?.data as ImportJob;
};

export const startAsanaAuth = async (jobId: string) => {
  const { data } = await apiClient.post(`/api/imports/${jobId}/auth/asana/start`);
  return data?.data as { authUrl: string; state: string };
};

export const mondayValidate = async (jobId: string, token: string) => {
  const { data } = await apiClient.post(`/api/imports/${jobId}/auth/monday/validate`, {
    token,
  });
  return data?.data as { authorized: boolean; boards: Array<{ id: string; name: string }> };
};

export const clickupWorkspaces = async (jobId: string, token: string) => {
  const { data } = await apiClient.post(`/api/imports/${jobId}/auth/clickup/workspaces`, {
    token,
  });
  return data?.data as {
    authorized: boolean;
    teams: Array<{
      id: string;
      name: string;
      spaces: Array<{ id: string; name: string; lists: Array<{ id: string; name: string }> }>;
    }>;
  };
};

export const getImportJob = async (jobId: string) => {
  const { data } = await apiClient.get(`/api/imports/${jobId}`);
  return data?.data as ImportJob;
};
