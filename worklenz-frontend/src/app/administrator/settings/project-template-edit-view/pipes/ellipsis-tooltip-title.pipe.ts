import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'ellipsisTooltipTitlePT'
})
export class EllipsisTooltipTitlePipe2 implements PipeTransform {

  transform(value: string | undefined, limit: number): string {
    if (!value) return '';
    return value.length > limit ? value : '';
  }

}
