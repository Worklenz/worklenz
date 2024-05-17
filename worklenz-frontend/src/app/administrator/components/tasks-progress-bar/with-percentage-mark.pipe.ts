import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'withPercentageMark',
  standalone: true
})
export class WithPercentageMarkPipe implements PipeTransform {
  transform(value: string | number): string {
    return `${value}%`;
  }
}
