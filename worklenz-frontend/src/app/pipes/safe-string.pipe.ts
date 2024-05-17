import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'safeString',
  standalone: true
})
export class SafeStringPipe implements PipeTransform {
  transform(value?: any): string {
    const stringValue = String(value);
    if (stringValue === 'null' || stringValue === 'undefined' || stringValue === 'NaN') {
      return '';
    }

    return stringValue;
  }
}
