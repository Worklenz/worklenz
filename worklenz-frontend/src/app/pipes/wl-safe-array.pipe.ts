import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'wlSafeArray',
  standalone: true
})
export class WlSafeArrayPipe implements PipeTransform {
  transform(value: any, ...args: unknown[]) {
    return !Array.isArray(value) ? [] : value;
  }
}
