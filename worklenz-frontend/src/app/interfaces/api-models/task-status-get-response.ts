import {ITaskStatus} from '@interfaces/task-status';

export interface ITaskStatusViewModel extends ITaskStatus {
  category_id?: string;
  category_name?: string;
}
