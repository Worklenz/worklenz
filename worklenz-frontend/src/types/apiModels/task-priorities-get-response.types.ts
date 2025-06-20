import { ITaskPriority } from '../tasks/taskPriority.types';

export interface ITaskPrioritiesGetResponse extends ITaskPriority {
  color_code?: string;
}
