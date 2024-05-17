import {Pipe, PipeTransform} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";

@Pipe({
  name: 'subTasksArrowColor'
})
export class SubTasksArrowColorPipe implements PipeTransform {
  transform(value: IProjectTask, ...args: unknown[]): string {
    return !!value.sub_tasks_count ? '#191919' : 'rgba(0, 0, 0, 0.45)';
  }
}
