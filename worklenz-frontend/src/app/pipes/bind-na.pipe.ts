import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'bindNa',
  standalone: true
})
export class BindNaPipe implements PipeTransform {
  transform(value?: string): string {
    return value?.trim() || "-";
  }
}
