import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'subTasksArrowIconPT'
})
export class SubTasksArrowIconPipe2 implements PipeTransform {
  transform(value?: boolean, ...args: unknown[]): string {
    return value ? 'down' : 'right';
  }
}
