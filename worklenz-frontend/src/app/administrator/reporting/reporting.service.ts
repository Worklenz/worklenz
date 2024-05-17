import {Injectable} from '@angular/core';
import {IRPTDuration, IRPTTeam} from "./interfaces";
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ReportingService {
  private _currentOrganization: string | null = null;
  private _currentTeam: IRPTTeam | null = null;

  private _duration: IRPTDuration | null = null;
  private _dateRange: string[] = [];

  private _drawerDuration: IRPTDuration | null = null;
  private _drawerDateRange: string[] = [];

  private _includeArchived = false;

  private readonly _durationChangedSbj$ = new Subject<void>();
  private readonly _dateRangeChangedSbj$ = new Subject<void>();
  private readonly _drawerDurationChangedSbj$ = new Subject<void>();
  private readonly _drawerDateRangeChangedSbj$ = new Subject<void>();
  private readonly _archivedToggleChangedSbj$ = new Subject<void>();

  get currentOrganization(): string | null {
    return this._currentOrganization;
  }

  set currentOrganization(value: string | null) {
    this._currentOrganization = value;
  }

  public setCurrentTeam(team: IRPTTeam | null) {
    this._currentTeam = team;
  }

  public getCurrentTeam() {
    return this._currentTeam;
  }

  // Reporting Filters
  public setDuration(duration: IRPTDuration | null) {
    this._duration = duration;
  }

  public setDrawerDuration(duration: IRPTDuration | null) {
    this._drawerDuration = duration;
  }

  public setDateRange(range: string[]) {
    this._dateRange = range;
  }

  public setDrawerDateRange(range: string[]) {
    this._drawerDateRange = range;
  }

  public getDuration() {
    return this._duration;
  }

  public getDrawerDuration() {
    return this._drawerDuration;
  }

  public getDateRange() {
    return this._dateRange;
  }

  public getDrawerDateRange() {
    return this._drawerDateRange;
  }

  public setIncludeToggle(status: boolean) {
    this._includeArchived = status;
  }

  public getIncludeToggle() {
    return this._includeArchived;
  }

  get onDurationChange() {
    return this._durationChangedSbj$.asObservable();
  }

  public emitDurationChanged() {
    this._durationChangedSbj$.next();
  }

  get onDrawerDurationChange() {
    return this._drawerDurationChangedSbj$.asObservable();
  }

  public emitDrawerDurationChanged() {
    this._drawerDurationChangedSbj$.next();
  }

  get onDateRangeChange() {
    return this._dateRangeChangedSbj$.asObservable();
  }

  public emitDateRangeChanged() {
    this._dateRangeChangedSbj$.next();
  }

  get onDrawerDateRangeChange() {
    return this._drawerDateRangeChangedSbj$.asObservable();
  }

  public emitDrawerDateRangeChanged() {
    this._drawerDateRangeChangedSbj$.next();
  }

  get onIncludeToggleChange() {
    return this._archivedToggleChangedSbj$.asObservable();
  }

  public emitIncludeToggleChanged() {
    this._archivedToggleChangedSbj$.next();
  }
}
