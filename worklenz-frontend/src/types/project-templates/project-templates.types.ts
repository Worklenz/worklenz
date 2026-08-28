export interface IWorklenzTemplate {
  id?: string;
  name?: string;
  image_url?: string;
  task_count?: number;
  phase_count?: number;
}

interface IPhase {
  name?: string;
  color_code?: string;
}

interface IStatus {
  name?: string;
  color_code?: string;
}

interface IPriority {
  name?: string;
  color_code?: string;
}

interface ILabel {
  name?: string;
  color_code?: string;
}

interface ITemplateTask {
  name?: string;
  status_name?: string;
  priority_name?: string;
  phases?: { name?: string }[];
  labels?: { name?: string }[];
}

export interface IProjectTemplate {
  id?: string;
   project_id?: string;
  name?: string;
  image_url?: string;
  description?: string;
  phases?: IPhase[];
  status?: IStatus[];
  priorities?: IPriority[];
  labels?: ILabel[];
  tasks?: ITemplateTask[];
}

export interface ICustomTemplate {
  id?: string;
  name?: string;
  color_code?: string;
  selected?: boolean;
  created_at?: string;
}

export interface IAccountSetupRequest {
  team_name?: string;
  project_name?: string | null;
  tasks: string[];
  team_members: string[];
  template_id?: string | null;
  survey_data?: {
    organization_type?: string;
    user_role?: string;
    main_use_cases?: string[];
    previous_tools?: string;
    how_heard_about?: string;
  };
}

export interface IAccountSetupResponse {
  id?: string;
  has_invitations?: boolean;
}
