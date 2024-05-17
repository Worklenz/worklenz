export interface IProjectTemplateLabel {
    label_id?: string;
    name?: string;
    color_code?: string;
}

export interface IProjectTemplate {
    name?: string;
    id?: string;
    key?: string;
    description?: string;
    phase_label?: string;
    phases?: any;
    tasks?: any;
    status?: any;
}

export interface IProjectTemplatePhase {
    id?: string;
    name?: string;
    color_code?: string;
}

export interface IProjectTemplateStatus {
    id?: string;
    name?: string;
    category_id?: string;
    category_name?: string;
    sort_order?: string;
}

export interface IProjectTaskPhase {
    name?: string;
}

export interface IProjectTemplateTask {
    id?: string;
    name?: string;
    description?: string | null;
    total_minutes?: number;
    sort_order?: number;
    priority_id?: string;
    priority_name?: string;
    new?: number;
    parent_task_id?: string | null;
    status_id?: string;
    status_name?: string;
    phase_id?: string;
    phase_name?: string;
    phases?: IProjectTaskPhase[];
    labels?: IProjectTemplateLabel[];
    task_no?: number;
    original_task_id?: string;
}

export interface ITaskIncludes {
    status?: boolean;
    phase?: boolean;
    labels?: boolean;
    estimation?: boolean;
    description?: boolean;
    subtasks?: boolean;
}

export interface ICustomProjectTemplate {
    name?: string;
    phase_label?: string;
    color_code?: string;
    notes?: string;
    team_id?: string;
}

export interface ICustomTemplatePhase {
    name?: string;
    color_code?: string;
    template_id?: string;
}

export interface ICustomTemplateTask {
    name?: string; 
    description: string; 
    total_minutes: string; 
    sort_order: string; 
    priority_id: string; 
    template_id: string; 
    parent_task_id: string; 
    status_id?: string;
}
