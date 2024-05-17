import {Injectable} from '@angular/core';
import {INotificationSettings} from "@interfaces/notification-settings";
import {BehaviorSubject, ReplaySubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class NotificationSettingsService {
  private readonly _countsUpdateSbj$ = new BehaviorSubject(0);
  private readonly _clickSbj$ = new ReplaySubject<{ project: string; task: string; }>();

  settings: INotificationSettings = {};
  count = 0;

  public get onCountsUpdate$() {
    return this._countsUpdateSbj$.asObservable();
  }

  public get onNotificationClick() {
    return this._clickSbj$.asObservable();
  }

  public emitCountsUpdate() {
    this._countsUpdateSbj$.next(0);
  }

  public emitNotificationClick(data: { project: string; task: string; }) {
    this._clickSbj$.next(data);
  }
}
