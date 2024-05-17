import {Pipe, PipeTransform} from '@angular/core';
import moment from "moment";

@Pipe({
  name: 'toNow',
  standalone: true
})
export class ToNowPipe implements PipeTransform {
  transform(value?: any): string | undefined {
    if (!value) return value;
    return moment(value).toNow();
  }
}
