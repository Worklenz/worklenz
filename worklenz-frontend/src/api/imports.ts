import apiClient from './api-client';

export interface ImportJob {
  id: string;
  provider: string;
  flow_type: 'direct' | 'csv';
  status?: 'pending' | 'ready' | 'running' | 'success' | 'failed';
  error_message?: string | null;
}

export interface ImportProgress {
  job: ImportJob;
  counts: {
    hierarchy: number;
    fields: number;
    values: number;
    users: number;
    stageTasks: number;
    attachments: number;
  };
  recentLogs: Array<{ level: string; message: string; created_at: string }>;
}

export const createImportJob = async (payload: {
  provider: string;
  flowType: 'direct' | 'csv';
  targetProjectId?: string | null;
  targetSpaceType?: string | null;
  targetTemplate?: string | null;
  sourceReference?: Record<string, unknown> | null;
}) => {
  const { data } = await apiClient.post('/api/v1/imports', payload);
  return data?.body as ImportJob;
};

export const startAsanaAuth = async (jobId: string) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/auth/asana/start`);
  return data?.body as { authUrl: string; state: string };
};

export const mondayValidate = async (jobId: string, token: string) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/auth/monday/validate`, {
    token,
  });
  return data?.body as { authorized: boolean; boards: Array<{ id: string; name: string }> };
};

export const clickupWorkspaces = async (jobId: string, token: string) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/auth/clickup/workspaces`, {
    token,
  });
  return data?.body as {
    authorized: boolean;
    teams: Array<{
      id: string;
      name: string;
      spaces: Array<{ id: string; name: string; lists: Array<{ id: string; name: string }> }>;
    }>;
  };
};

export const trelloValidate = async (jobId: string, payload: { key: string; token: string }) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/auth/trello/validate`, payload);
  return data?.body as {
    authorized: boolean;
    boards: Array<{ id: string; name: string; url?: string }>;
  };
};

export const jiraValidate = async (
  jobId: string,
  payload: { token: string; email: string; domain: string }
) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/auth/jira/validate`, payload);
  return data?.body as {
    authorized: boolean;
    projects: Array<{ key: string; name: string }>;
  };
};

export const getImportJob = async (jobId: string) => {
  const { data } = await apiClient.get(`/api/v1/imports/${jobId}`, {
    params: { ts: Date.now() },
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  return data?.body as ImportJob;
};

export const updateImportTarget = async (
  jobId: string,
  payload: {
    targetProjectId: string;
    targetSpaceType?: string | null;
    targetTemplate?: string | null;
  }
) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/target`, payload);
  return data?.body as ImportJob;
};

export const updateImportSource = async (
  jobId: string,
  payload: {
    workspaceId?: string | null;
    projectId?: string;
    projectKey?: string;
    projectName?: string | null;
    token?: string;
    key?: string;
    boardId?: string | null;
    boardName?: string | null;
    importMembers?: boolean;
    importAttachments?: boolean;
  }
) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/source`, payload);
  return data?.body as ImportJob;
};

export const ingestImportJob = async (
  jobId: string,
  payload: { csvText?: string; sourceReference?: Record<string, unknown> }
) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/ingest`, payload);
  return data?.body as { job: ImportJob };
};

export const saveImportFields = async (
  jobId: string,
  fields: Array<{
    source_field: string;
    target_field: string;
    required?: boolean;
    include?: boolean;
  }>
) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/fields`, {
    fields,
  });
  return data?.body as typeof fields;
};

export const saveImportValueMappings = async (
  jobId: string,
  values: Array<{
    source_value: string;
    target_worktype: string;
    include?: boolean;
  }>
) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/value-mappings`, {
    values,
  });
  return data?.body as typeof values;
};

export const saveImportUserMappings = async (
  jobId: string,
  users: Array<{
    source_user_id?: string | null;
    source_email?: string | null;
    target_user_id?: string | null;
    resolution?: string;
    include?: boolean;
  }>
) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/user-mappings`, {
    users,
  });
  return data?.body as typeof users;
};

export const commitImportJob = async (jobId: string) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/commit`);
  return data?.body as ImportProgress;
};

export const getImportProgress = async (jobId: string) => {
  const { data } = await apiClient.get(`/api/v1/imports/${jobId}/progress`);
  return data?.body as ImportProgress;
};

export const autoImportFields = async (jobId: string) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/fields/auto`);
  return data?.body;
};

export const autoImportHierarchy = async (jobId: string) => {
  const { data } = await apiClient.post(`/api/v1/imports/${jobId}/hierarchy/auto`);
  return data?.body;
};
