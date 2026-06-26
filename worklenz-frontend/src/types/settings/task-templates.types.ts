export interface ITaskTemplatesGetResponse {
  name?: string;
  id?: string;
  created_at?: string;
}

/** Level-3: a subtask of a subtask (grandchild). No further nesting — matches DB 3-level limit. */
export interface ITaskTemplateGrandChildTask {
  name: string;
  total_minutes?: number;
}

/** Level-2: a subtask of a parent task. May itself have sub_tasks (level-3). */
export interface ITaskTemplateSubTask {
  name: string;
  total_minutes?: number;
  sub_tasks?: ITaskTemplateGrandChildTask[];
}

/** Level-1: a top-level template task. May have sub_tasks (level-2). */
export interface ITaskTemplateTask {
  name: string;
  total_minutes?: number;
  sub_tasks?: ITaskTemplateSubTask[];
}

/**
 * Flat row sent to the import DB function.
 * - parent_task_name = null  → top-level task
 * - parent_task_name = <name> → subtask of that parent (any depth)
 */
export interface ITaskTemplateImportRow {
  name: string;
  total_minutes?: number;
  parent_task_name?: string | null;
}

export interface ITaskTemplateGetResponse {
  id?: string;
  name?: string;
  tasks?: ITaskTemplateTask[];
}
