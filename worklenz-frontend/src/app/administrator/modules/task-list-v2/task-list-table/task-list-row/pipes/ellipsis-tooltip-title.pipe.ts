import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'ellipsisTooltipTitle'
})
export class EllipsisTooltipTitlePipe implements PipeTransform {

  transform(value: string | undefined, limit: number): string {
    if (!value) return '';
    return value.length > limit ? value : '';
  }

}
