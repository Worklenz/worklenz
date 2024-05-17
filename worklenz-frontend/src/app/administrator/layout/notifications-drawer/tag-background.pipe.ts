import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'tagBackground'
})
export class TagBackgroundPipe implements PipeTransform {
  transform(value?: string) {
    if (!value) {
      value = "#333333";
    }
    return `background-color: ${value}ff;color: ${value};border: 1px solid ${value};`;
  }
}
