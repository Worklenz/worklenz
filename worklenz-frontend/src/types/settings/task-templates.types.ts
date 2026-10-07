export interface ITaskTemplatesGetResponse {
  name?: string;
  id?: string;
  created_at?: string;
  scope?: 'team' | 'organization';
  can_manage?: boolean;
}

/** Level-3: a subtask of a subtask (grandchild). No further nesting — matches DB 3-level limit. */
export interface ITaskTemplateGrandChildTask {
  id?: string;
  name: string;
  total_minutes?: number;
}

/** Level-2: a subtask of a parent task. May itself have sub_tasks (level-3). */
export interface ITaskTemplateSubTask {
  id?: string;
  name: string;
  total_minutes?: number;
  sub_tasks?: ITaskTemplateGrandChildTask[];
}

/** Level-1: a top-level template task. May have sub_tasks (level-2). */
export interface ITaskTemplateTask {
  id?: string;
  name: string;
  total_minutes?: number;
  sub_tasks?: ITaskTemplateSubTask[];
}

export interface ITaskTemplateGetResponse {
  id?: string;
  name?: string;
  tasks?: ITaskTemplateTask[];
}
