import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'firstCharUpper',
  standalone: true
})
export class FirstCharUpperPipe implements PipeTransform {
  transform(value?: string, ...args: unknown[]): string {
    if (!value) return '';
    return value.charAt(0).toUpperCase();
  }
}
