import {ITaskListGroup} from 'app/administrator/modules/task-list-v2/interfaces';

export class Board {
  constructor(public columns: ITaskListGroup[]) {
  }
}
