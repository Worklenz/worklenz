import {Pipe, PipeTransform} from '@angular/core';
import {IPTTask} from "../interfaces";

@Pipe({
  name: 'subTasksArrowColorPT'
})
export class SubTasksArrowColorPipe2 implements PipeTransform {
  transform(value: IPTTask, ...args: unknown[]): string {
    return !!value.sub_tasks_count ? '#191919' : 'rgba(0, 0, 0, 0.45)';
  }
}
