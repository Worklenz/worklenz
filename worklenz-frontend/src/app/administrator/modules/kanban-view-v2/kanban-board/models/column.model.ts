import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';

export class Column {
  constructor(
    public name: string,
    public id: string,
    public data: IProjectTask[],
    public category_id?: string,
    public category_name?: string,
    public color_code?: string,
    public description?: string
  ) {
  }
}
