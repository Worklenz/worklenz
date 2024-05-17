import {Injectable} from '@angular/core';
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ReportingService {

  private readonly _teamDrawerCloseSbj$ = new Subject<void>();
  private readonly _projectDrawerCloseSbj$ = new Subject<void>();
  private readonly _memberDrawerCloseSbj$ = new Subject<void>();

  get onProjectDrawerClose() {
    return this._projectDrawerCloseSbj$.asObservable();
  }

  get onMemberDrawerClose() {
    return this._memberDrawerCloseSbj$.asObservable();
  }

  get onTeamDrawerClose() {
    return this._teamDrawerCloseSbj$.asObservable();
  }

  public emitProjectDrawerClose() {
    this._projectDrawerCloseSbj$.next();
  }

  public emitMemberDrawerClose() {
    this._memberDrawerCloseSbj$.next();
  }

  public emitTeamDrawerClose() {
    this._teamDrawerCloseSbj$.next();
  }
}
