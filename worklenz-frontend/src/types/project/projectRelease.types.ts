import { IssueType } from './softwareIssue.types';

export type ReleaseStatus = 'unreleased' | 'released';

export type ReleaseConfidence = 'released' | 'planning' | 'overdue' | 'atRisk' | 'onTrack';

export interface IProjectRelease {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  /** ISO date (YYYY-MM-DD). */
  target_date: string | null;
  status: ReleaseStatus;
  released_at: string | null;
  created_at: string;
  issue_count: number;
  done_issue_count: number;
  open_critical_bug_count: number;
  blocked_count: number;
  total_points: number;
  done_points: number;
}

export interface IProjectReleaseInput {
  name: string;
  description?: string | null;
  target_date?: string | null;
}

export interface IReleaseWorkItem {
  id: string;
  task_key: string;
  name: string;
  issue_type: IssueType;
  parent_task_id: string | null;
  story_points: number | null;
  is_blocked: boolean;
  release_id: string | null;
  status_name: string | null;
  status_color: string | null;
  status_color_dark: string | null;
  is_done: boolean;
  priority_value: number | null;
  epic_id: string | null;
  epic_name: string | null;
  epic_color: string | null;
  sprint_id: string | null;
  sprint_name: string | null;
  assignee_name: string | null;
  assignee_avatar_url: string | null;
}

export interface IReleaseAddItemsResult {
  added_count: number;
  release: IProjectRelease;
}

export interface ITaskReleaseAssignment {
  id: string;
  release_id: string | null;
}
