import {Injectable} from '@angular/core';
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class AdminCenterService {
  private readonly _teamCreateSbj$ = new Subject<void>();
  private readonly _teamNameChangeSbj$ = new Subject<{ teamId: string, teamName: string }>();

  get onCreateTeam() {
    return this._teamCreateSbj$.asObservable();
  }

  get onTeamNameChange() {
    return this._teamNameChangeSbj$.asObservable();
  }

  public emitCreateTeam() {
    this._teamCreateSbj$.next();
  }

  public emitTeamNameChange(response: { teamId: string, teamName: string }) {
    this._teamNameChangeSbj$.next(response);
  }

}
