import {ITaskPriority} from '../task-priority';

export interface ITaskPrioritiesGetResponse extends ITaskPriority {
  color_code?: string;
}
