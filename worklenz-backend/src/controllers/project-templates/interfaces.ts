/**
 * Represents a label/tag that can be applied to template tasks.
 */
export interface IProjectTemplateLabel {
    /** UUID of the label */
    label_id?: string;
    
    /** Display name of the label */
    name?: string;
    
    /** Hex color code for the label (e.g., "#FF5733") */
    color_code?: string;
}

/**
 * Represents a project template (default templates provided by the system).
 */
export interface IProjectTemplate {
    /** Template name */
    name?: string;
    
    /** Unique identifier for the template */
    id?: string;
    
    /** Project key/code */
    key?: string;
    
    /** Template description */
    description?: string;
    
    /** Label for project phases */
    phase_label?: string;
    
    /** Array of phases in the template */
    phases?: any;
    
    /** Array of tasks in the template */
    tasks?: any;
    
    /** Array of task statuses in the template */
    status?: any;
}

/**
 * Represents a phase within a project template.
 */
export interface IProjectTemplatePhase {
    /** UUID of the phase */
    id?: string;
    
    /** Phase name */
    name?: string;
    
    /** Hex color code for the phase */
    color_code?: string;
}

/**
 * Represents a task status within a project template.
 */
export interface IProjectTemplateStatus {
    /** UUID of the status */
    id?: string;
    
    /** Status name (e.g., "To Do", "In Progress", "Done") */
    name?: string;
    
    /** UUID of the status category */
    category_id?: string;
    
    /** Category name (e.g., "TODO", "DOING", "DONE") */
    category_name?: string;
    
    /** Sort order for displaying statuses */
    sort_order?: string;
}

/**
 * Represents a phase associated with a specific task.
 */
export interface IProjectTaskPhase {
    /** Phase name */
    name?: string;
}

/**
 * Represents a task within a project template (both default and custom templates).
 * This interface is used for template creation, storage, and import operations.
 */
export interface IProjectTemplateTask {
    /** Unique identifier for the task */
    id?: string;
    
    /** Task name/title */
    name?: string;
    
    /** Detailed description of the task */
    description?: string | null;
    
    /** Estimated time in minutes to complete the task */
    total_minutes?: number;
    
    /** General sort order for the task within the project */
    sort_order?: number;
    
    /** UUID reference to the task priority */
    priority_id?: string;
    
    /** Human-readable priority name (e.g., "High", "Medium", "Low") */
    priority_name?: string;
    
    /** Flag indicating if this is a newly created task */
    new?: number;
    
    /** UUID reference to parent task (for subtasks), null for top-level tasks */
    parent_task_id?: string | null;
    
    /** UUID reference to the task status */
    status_id?: string;
    
    /** Human-readable status name (e.g., "To Do", "In Progress", "Done") */
    status_name?: string;
    
    /** UUID reference to the task phase */
    phase_id?: string;
    
    /** Human-readable phase name */
    phase_name?: string;
    
    /** Array of phases associated with this task */
    phases?: IProjectTaskPhase[];
    
    /** Array of labels/tags associated with this task */
    labels?: IProjectTemplateLabel[];
    
    /** Sequential task number within the project */
    task_no?: number;
    
    /**
     * Sort order when tasks are grouped by status.
     * This value preserves the task's position within its status group
     * during template creation and import operations.
     * @default 0
     */
    status_sort_order?: number;
    
    /**
     * Sort order when tasks are grouped by priority.
     * This value preserves the task's position within its priority group
     * during template creation and import operations.
     * @default 0
     */
    priority_sort_order?: number;
    
    /**
     * Sort order when tasks are grouped by phase.
     * This value preserves the task's position within its phase group
     * during template creation and import operations.
     * @default 0
     */
    phase_sort_order?: number;
    
    /** Reference to the original task ID (used during template import to maintain relationships) */
    original_task_id?: string;
}

/**
 * Configuration object for specifying which task fields to include in queries.
 * Used to optimize data retrieval by only fetching necessary fields.
 */
export interface ITaskIncludes {
    /** Include task status information */
    status?: boolean;
    
    /** Include task phase information */
    phase?: boolean;
    
    /** Include task labels/tags */
    labels?: boolean;
    
    /** Include time estimation data */
    estimation?: boolean;
    
    /** Include task description */
    description?: boolean;
    
    /** Include subtask information */
    subtasks?: boolean;
}

/**
 * Represents a custom project template created by users.
 * Custom templates are created from existing projects and stored in the database.
 */
export interface ICustomProjectTemplate {
    /** Template name */
    name?: string;
    
    /** Label for project phases */
    phase_label?: string;
    
    /** Hex color code for the template */
    color_code?: string;
    
    /** Additional notes or description for the template */
    notes?: string;
    
    /** UUID of the team that owns this template */
    team_id?: string;
}

/**
 * Represents a phase within a custom project template.
 */
export interface ICustomTemplatePhase {
    /** Phase name */
    name?: string;
    
    /** Hex color code for the phase */
    color_code?: string;
    
    /** UUID of the parent template */
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

export interface ICustomColumn {
    id?: string;
    name: string;
    key: string;
    field_type: string;
    width?: number;
    is_visible?: boolean;
    is_custom_column?: boolean;
    sort_order?: number;
}

export interface IColumnConfiguration {
    field_title?: string;
    field_type?: string;
    number_type?: string;
    decimals?: number;
    label?: string;
    label_position?: string;
    expression?: string;
    first_numeric_column_id?: string;
    second_numeric_column_id?: string;
    first_numeric_column_key?: string;
    second_numeric_column_key?: string;
}

export interface ISelectionOption {
    selection_id: string;
    selection_name: string;
    selection_color?: string;
    selection_order: number;
}

export interface ILabelOption {
    label_id: string;
    label_name: string;
    label_color?: string;
    label_order: number;
}

export interface ICustomColumnWithConfig extends ICustomColumn {
    configuration?: IColumnConfiguration;
    selection_options?: ISelectionOption[];
    label_options?: ILabelOption[];
}
