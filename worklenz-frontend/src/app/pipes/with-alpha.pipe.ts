import {Pipe, PipeTransform} from '@angular/core';
import {ALPHA_CHANNEL} from "@shared/constants";

@Pipe({
  name: 'withAlpha',
  standalone: true
})
export class WithAlphaPipe implements PipeTransform {
  transform(value?: string, ...args: unknown[]): string {
    if (!value) return '';
    return value + ALPHA_CHANNEL;
  }
}
