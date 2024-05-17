import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'withCount'
})
export class WithCountPipe implements PipeTransform {
  transform(label: string, count?: number): string {
    return `${label} (${count || 0})`;
  }
}
