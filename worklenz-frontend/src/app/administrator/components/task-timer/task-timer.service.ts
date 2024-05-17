import {Injectable} from '@angular/core';
import {Subject} from "rxjs";
import {ITimerChange} from "@admin/components/task-timer/interfaces";

@Injectable({
  providedIn: 'root'
})
export class TaskTimerService {
  private readonly _startSbj$ = new Subject<ITimerChange>();
  private readonly _stopSbj$ = new Subject<ITimerChange>();
  private readonly _submitOrUpdateSbj$ = new Subject<void>();
  private readonly _listTimerStopSbj$ = new Subject<string>();

  public get onStart() {
    return this._startSbj$.asObservable();
  }

  public get onStop() {
    return this._stopSbj$.asObservable();
  }

  public get onSubmitOrUpdate() {
    return this._submitOrUpdateSbj$.asObservable();
  }

  public get onListTimerStop() {
    return this._listTimerStopSbj$.asObservable();
  }

  public emitStart(taskId: string, startTime = 0) {
    this._startSbj$.next({
      task_id: taskId,
      start_time: startTime
    });
  }

  public emitStop(taskId: string) {
    this._stopSbj$.next({
      task_id: taskId,
      start_time: 0
    });
  }

  public emitSubmitOrUpdate() {
    this._submitOrUpdateSbj$.next();
  }

  public emitListTimerStop(taskId: string) {
    this._listTimerStopSbj$.next(taskId);
  }

}
