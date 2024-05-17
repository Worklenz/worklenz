import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'projectFilterByTooltip'
})
export class ProjectFilterByTooltipPipe implements PipeTransform {
  transform(name?: string): string {
    return `Click to filter by "${name}".`;
  }
}
