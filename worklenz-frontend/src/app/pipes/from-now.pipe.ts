import {Pipe, PipeTransform} from '@angular/core';
import moment from "moment/moment";

@Pipe({
  name: 'fromNow',
  standalone: true
})
export class FromNowPipe implements PipeTransform {
  transform(value?: any): string | undefined {
    if (!value) return value;
    return moment(value).fromNow();
  }
}
