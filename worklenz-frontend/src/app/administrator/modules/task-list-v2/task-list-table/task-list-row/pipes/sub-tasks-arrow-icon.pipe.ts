import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'subTasksArrowIcon'
})
export class SubTasksArrowIconPipe implements PipeTransform {
  transform(value?: boolean, ...args: unknown[]): string {
    return value ? 'down' : 'right';
  }
}
