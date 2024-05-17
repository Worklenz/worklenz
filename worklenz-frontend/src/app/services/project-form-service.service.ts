import {Injectable} from '@angular/core';
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ProjectFormService {
  private readonly _updateSbj$ = new Subject<void>();
  private readonly _onProjectMemberChangeSbj$ = new Subject<void>();

  public get onProjectUpdate() {
    return this._updateSbj$.asObservable();
  }

  public get onMemberAssignOrRemoveReProject() {
    return this._onProjectMemberChangeSbj$.asObservable();
  }

  public emitProjectUpdate() {
    this._updateSbj$.next();
  }

  public emitMemberAssignOrRemoveReProject() {
    this._onProjectMemberChangeSbj$.next();
  }

}
