import type { IReleaseWorkItem } from './projectRelease.types';

/** Issue type stored on a task. Subtasks are derived from `parent_task_id`. */
export type IssueType = 'task' | 'story' | 'bug';

/** Types offered when creating a work item. `epic` creates a project Epic instead of a task. */
export type CreatableIssueType = IssueType | 'subtask' | 'epic';

export interface ICreateSoftwareIssueRequest {
  project_id: string;
  name: string;
  description?: string | null;
  issue_type: IssueType | 'subtask';
  assignee_id?: string | null;
  epic_id?: string | null;
  story_points?: number | null;
  phase_id?: string | null;
  /** Defaults to the project's first status (Backlog) when omitted. */
  status_id?: string | null;
  parent_task_id?: string | null;
}

/** Row of the software project List tab. */
export interface ISoftwareWorkItem extends IReleaseWorkItem {
  priority_name: string | null;
  priority_color: string | null;
  priority_color_dark: string | null;
  /** Assigned to the requesting user. */
  is_mine: boolean;
}

export interface ICreateSoftwareIssueResponse {
  id: string;
  task_key: string | null;
}
