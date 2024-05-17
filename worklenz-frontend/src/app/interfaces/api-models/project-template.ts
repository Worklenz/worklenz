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
