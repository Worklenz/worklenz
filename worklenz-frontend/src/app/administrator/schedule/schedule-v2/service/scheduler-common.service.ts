import {Injectable} from '@angular/core';
import moment from "moment";
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class SchedulerCommonService {

  public readonly GANNT_COLUMN_WIDTH = 35;

  startDate: string | null = null;
  endDate: string | null = null;

  private readonly scrollAmount$Sbj = new Subject<number>();

  get onScrollToDate() {
    return this.scrollAmount$Sbj.asObservable();
  }

  public emitScrollToDate(scrollAmount: number) {
    this.scrollAmount$Sbj.next(scrollAmount);
  }

  scrollToDay(dateToScroll: Date) {

    const formattedStartDate = moment(this.startDate).format("YYYY-MM-DD");
    const formattedDateToScroll = moment(dateToScroll).format("YYYY-MM-DD");
    const daysDifference = moment(formattedDateToScroll).diff(formattedStartDate, "days");

    this.emitScrollToDate(daysDifference * this.GANNT_COLUMN_WIDTH);

  }

}
