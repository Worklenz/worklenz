import {Pipe, PipeTransform} from '@angular/core';
import {ITaskLabel} from "@interfaces/task-label";

@Pipe({
  name: 'endNameCheckPT'
})
export class EndNameCheckPipe2 implements PipeTransform {
  transform(value: ITaskLabel, ...args: unknown[]): unknown {
    return !!(value.end && value.names);
  }
}
