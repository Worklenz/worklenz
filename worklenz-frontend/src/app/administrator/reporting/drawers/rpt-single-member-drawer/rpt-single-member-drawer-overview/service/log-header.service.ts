import {Injectable} from '@angular/core';
import {IRPTDuration} from "../../../../interfaces";
import {ALL_TIME, LAST_MONTH, LAST_QUARTER, LAST_WEEK, YESTERDAY} from "@shared/constants";
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class LogHeaderService {

  public dateRange: string[] = [];
  public durations: IRPTDuration[] = [
    {label: "Yesterday", key: YESTERDAY},
    {label: "Last 7 days", key: LAST_WEEK},
    {label: "Last 30 days", key: LAST_MONTH},
    {label: "Last 3 months", key: LAST_QUARTER},
    {label: "All time", key: ALL_TIME}
  ];
  public selectedDuration: IRPTDuration | null = null;

  public readonly _durationChange = new Subject<void>();

  get onDurationChange() {
    return this._durationChange.asObservable();
  }

  constructor() {
  }

  public emitDurationChange() {
    this._durationChange.next();
  }

}
