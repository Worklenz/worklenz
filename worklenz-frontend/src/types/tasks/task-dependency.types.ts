export interface ITaskDependency {
  id?: string;
  task_id?: string;
  task_name?: string;
  dependency_type?: IDependencyType;
  related_task_id?: string;
  related_task_name?: string;
  task_key?: string;
}

export enum IDependencyType {
  BLOCKED_BY = 'blocked_by',
}
