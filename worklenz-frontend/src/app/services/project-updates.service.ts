import { Injectable } from '@angular/core';
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ProjectUpdatesService {
  private readonly _emitRefreshSbj$ = new Subject<void>();
  private readonly _disableBadgeSbj$ = new Subject<void>();
  private readonly _getLastUpdateSbj$  = new Subject<void>();

  public get onRefresh() {
    return this._emitRefreshSbj$.asObservable();
  }

  public get onBadgeDisable() {
    return this._disableBadgeSbj$.asObservable();
  }

  public get onGetLatestUpdate() {
    return this._getLastUpdateSbj$.asObservable();
  }

  public emitRefresh() {
    this._emitRefreshSbj$.next();
  }

  public emitBadgeDisable() {
    this._disableBadgeSbj$.next();
  }

  public emitGetLastUpdate() {
    this._getLastUpdateSbj$.next();
  }

}
