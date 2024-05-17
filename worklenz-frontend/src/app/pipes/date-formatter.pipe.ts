import {Pipe, PipeTransform} from "@angular/core";
import moment from "moment";

@Pipe({
  name: 'dateFormatter',
  standalone: true
})

export class DateFormatterPipe implements PipeTransform {

  currentDate: moment.Moment = moment();
  currentYear = moment().year();

  transform(value: any) {

    if (value) {
      const date = this.currentDate;
      const isSame = (input: moment.Moment, duration: any) => moment(value).isSame(input, duration);

      if (moment(value).year() == this.currentYear) {
        if (moment(value).isSame(date.clone(), 'day')) {
          return "Today";
        } else if (isSame(date.clone().subtract(1, 'day'), 'day')) {
          return "Yesterday";
        } else if (isSame(date.clone().add(1, 'day'), 'day')) {
          return "Tomorrow";
        }
        return moment(value).format('MMM DD').toString();
      }
      return moment(value).format('MMM DD, YYYY').toString();
    }
    return null;
  }

}
