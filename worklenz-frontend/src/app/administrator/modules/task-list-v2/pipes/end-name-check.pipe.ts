import {Pipe, PipeTransform} from '@angular/core';
import {ITaskLabel} from "@interfaces/task-label";

@Pipe({
  name: 'endNameCheck'
})
export class EndNameCheckPipe implements PipeTransform {
  transform(value: ITaskLabel, ...args: unknown[]): unknown {
    return !!(value.end && value.names);
  }
}
