export interface IWorklenzTemplate {
  id?: string;
  name?: string;
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
}

export interface IProjectTemplate {
  id?: string;
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
}

export interface IAccountSetupRequest {
  team_name?: string;
  project_name?: string | null;
  tasks: string[];
  team_members: string[];
  template_id?: string | null;
}

export interface IAccountSetupResponse {
  id?: string;
  has_invitations?: boolean;
}
