import { ITaskStatus } from './taskStatus.types';

export interface ITaskStatusViewModel extends ITaskStatus {
  category_id?: string;
  category_name?: string;
}
