import { Injectable } from '@angular/core';
import {Subject} from "rxjs";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  private readonly newMemberCreatedSbj$ = new Subject<void>();

  get onNewMemberCreated() {
    return this.newMemberCreatedSbj$.asObservable();
  }

  public emitNewMemberCreated() {
    this.newMemberCreatedSbj$.next();
  }
}
