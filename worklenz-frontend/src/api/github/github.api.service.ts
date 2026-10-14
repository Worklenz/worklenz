import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${API_BASE_URL}/github`;

export interface IGithubIntegrationInfo {
  account_login: string;
  account_type: string;
  account_avatar_url: string | null;
  status: 'active' | 'suspended';
  connected_at: string;
  repository_count: number;
}

export interface IGithubStatus {
  /** False when the deployment has no GitHub App configured. */
  configured: boolean;
  connected: boolean;
  can_manage: boolean;
  integration: IGithubIntegrationInfo | null;
}

export type GithubTransitionEvent = 'branch_created' | 'pr_opened' | 'pr_merged';
export type IGithubStatusMap = Partial<Record<GithubTransitionEvent, string | null>>;

export interface IGithubProjectStatus {
  id: string;
  name: string;
  is_todo: boolean;
  is_doing: boolean;
  is_done: boolean;
}

export interface IGithubLinkedRepository {
  id: string;
  repository_id: string;
  full_name: string;
  is_private: boolean;
  is_available: boolean;
  default_branch: string;
  default_base_branch: string;
  settings: { status_map?: IGithubStatusMap } | null;
}

export interface IGithubAvailableRepository {
  id: string;
  full_name: string;
  is_private: boolean;
  default_branch: string;
}

export interface IGithubProjectRepositories {
  configured: boolean;
  connected: boolean;
  linked: IGithubLinkedRepository[];
  available: IGithubAvailableRepository[];
  statuses: IGithubProjectStatus[];
  /** True for team owners/admins, who can connect GitHub for the team. */
  can_connect: boolean;
  owner_name: string | null;
}

export type GithubReviewState = 'approved' | 'changes_requested' | 'review_required' | null;

export interface IGithubBranch {
  id: string;
  name: string;
  repository: string;
  is_deleted: boolean;
  html_url: string;
}

export interface IGithubPullRequest {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  is_draft: boolean;
  merged: boolean;
  review_state: GithubReviewState;
  head_branch: string | null;
  base_branch: string | null;
  author_login: string | null;
  author_avatar_url: string | null;
  html_url: string;
  opened_at: string | null;
  merged_at: string | null;
  closed_at: string | null;
  closes: boolean;
  repository: string;
}

export interface IGithubCommit {
  id: string;
  sha: string;
  message: string;
  author_name: string | null;
  author_login: string | null;
  html_url: string | null;
  committed_at: string | null;
  repository: string;
}

export interface IGithubTaskRepository {
  repository_id: string;
  full_name: string;
  default_base_branch: string;
}

export interface IGithubCreatedBranch {
  name: string;
  html_url: string;
  checkout_command: string;
}

export interface IGithubTaskDevelopment {
  has_linked_repositories: boolean;
  repositories: IGithubTaskRepository[];
  task_key: string;
  task_name: string;
  branches: IGithubBranch[];
  pull_requests: IGithubPullRequest[];
  commits: IGithubCommit[];
}

export const githubApiService = {
  getStatus: async () => {
    const response = await apiClient.get<IServerResponse<IGithubStatus>>(`${rootUrl}/status`);
    return response.data;
  },

  /** Pass a software project id to return to its settings after installing. */
  getInstallUrl: async (projectId?: string) => {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    const response = await apiClient.get<IServerResponse<{ url: string }>>(
      `${rootUrl}/install-url${query}`
    );
    return response.data;
  },

  disconnect: async () => {
    const response = await apiClient.delete<IServerResponse<null>>(`${rootUrl}/disconnect`);
    return response.data;
  },

  refreshRepositories: async () => {
    const response = await apiClient.post<IServerResponse<{ repository_count: number }>>(
      `${rootUrl}/repositories/refresh`
    );
    return response.data;
  },

  getProjectRepositories: async (projectId: string) => {
    const response = await apiClient.get<IServerResponse<IGithubProjectRepositories>>(
      `${rootUrl}/projects/${projectId}/repositories`
    );
    return response.data;
  },

  linkRepository: async (projectId: string, repositoryId: string, defaultBaseBranch?: string) => {
    const response = await apiClient.post<IServerResponse<{ id: string | null }>>(
      `${rootUrl}/projects/${projectId}/repositories`,
      { repository_id: repositoryId, default_base_branch: defaultBaseBranch || undefined }
    );
    return response.data;
  },

  updateRepositoryLink: async (
    projectId: string,
    linkId: string,
    changes: { default_base_branch?: string | null; status_map?: IGithubStatusMap }
  ) => {
    const response = await apiClient.put<IServerResponse<null>>(
      `${rootUrl}/projects/${projectId}/repositories/${linkId}`,
      changes
    );
    return response.data;
  },

  unlinkRepository: async (projectId: string, linkId: string) => {
    const response = await apiClient.delete<IServerResponse<null>>(
      `${rootUrl}/projects/${projectId}/repositories/${linkId}`
    );
    return response.data;
  },

  createBranch: async (
    taskId: string,
    body: { repository_id: string; name: string; base_branch: string }
  ) => {
    const response = await apiClient.post<IServerResponse<IGithubCreatedBranch>>(
      `${rootUrl}/tasks/${taskId}/branches`,
      body
    );
    return response.data;
  },

  getTaskDevelopment: async (taskId: string) => {
    const response = await apiClient.get<IServerResponse<IGithubTaskDevelopment>>(
      `${rootUrl}/tasks/${taskId}/development`
    );
    return response.data;
  },
};
