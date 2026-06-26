import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';

const rootUrl = `${API_BASE_URL}/reporting`;

export interface TeamLeadWithMembers {
  team_lead_id: string;
  team_lead_name: string;
  team_lead_email: string;
  team_lead_avatar_url?: string;
  managed_members: ManagedMember[];
}

export interface ManagedMember {
  member_id: string;
  member_name: string;
  member_email: string;
  member_avatar_url?: string;
  member_role_name: string;
  hierarchy_level: number;
}

export interface TeamLeadHierarchy {
  team_lead_id: string;
  team_lead_name: string;
  team_lead_email: string;
  team_lead_avatar_url?: string;
  managed_members_count: number;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  total_time_minutes: number;
  overdue_tasks: number;
  active_projects: number;
}

export interface TeamLeadPerformance {
  managed_member_id: string;
  managed_member_name: string;
  managed_member_email: string;
  member_avatar_url?: string;
  managed_member_role_name: string;
  hierarchy_level: number;
  assigned_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  total_time_minutes: number;
  overdue_tasks: number;
  active_projects: number;
  last_time_log?: string;
}

export interface TeamLeadTimeLog {
  managed_member_id: string;
  managed_member_name: string;
  time_log_id: string;
  time_spent: number;
  description?: string;
  logged_by_timer: boolean;
  logged_at: string;
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
}

export const teamLeadMembersApiService = {
  /**
   * Get all Team Leads and their managed members for reporting purposes
   * This is used by Admins/Owners to filter members by Team Lead
   */
  getTeamLeadsWithManagedMembers: async (): Promise<IServerResponse<TeamLeadWithMembers[]>> => {
    const response = await apiClient.get<IServerResponse<TeamLeadWithMembers[]>>(
      `${rootUrl}/team-leads-with-members`
    );
    return response.data;
  },

  /**
   * Get managed members for a specific Team Lead
   * Used when filtering by a specific Team Lead
   */
  getManagedMembersByTeamLead: async (
    teamLeadId: string
  ): Promise<IServerResponse<ManagedMember[]>> => {
    const response = await apiClient.get<IServerResponse<ManagedMember[]>>(
      `${rootUrl}/team-lead-members/${teamLeadId}`
    );
    return response.data;
  },

  /**
   * Get Team Lead hierarchy information for reporting
   * Returns Team Leads with their managed member counts and statistics
   */
  getTeamLeadHierarchy: async (): Promise<IServerResponse<TeamLeadHierarchy[]>> => {
    const response = await apiClient.get(`${rootUrl}/team-lead-hierarchy`);
    return response.data;
  },

  /**
   * Get detailed performance data for a specific Team Lead's managed members
   * Returns individual member performance metrics
   */
  getTeamLeadPerformance: async (
    teamLeadId: string
  ): Promise<IServerResponse<TeamLeadPerformance[]>> => {
    const response = await apiClient.get<IServerResponse<TeamLeadPerformance[]>>(
      `${rootUrl}/team-lead-performance/${teamLeadId}`
    );
    return response.data;
  },

  /**
   * Get time logs for a specific Team Lead's managed members
   * Used for detailed time tracking reports
   */
  getTeamLeadTimeLogs: async (
    teamLeadId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<IServerResponse<TeamLeadTimeLog[]>> => {
    const response = await apiClient.get<IServerResponse<TeamLeadTimeLog[]>>(
      `${rootUrl}/team-lead-time-logs/${teamLeadId}`,
      { params }
    );
    return response.data;
  },
};
