import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'truncateIfLong'
})
export class TruncateIfLongPipe implements PipeTransform {
  transform(value?: string, len = 0): string {
    if (!value) return '';
    return value.length > len ? `${value.slice(0, len)}...` : value;
  }
}
