import {Injectable} from '@angular/core';
import {IProjectFolder} from "@interfaces/project-folder";
import {Subject} from "rxjs";

export type FolderCreateEventCallback = (folder?: IProjectFolder) => void;

@Injectable({
  providedIn: 'root'
})
export class ProjectsFolderFormDrawerService {
  private _createSbj$ = new Subject<FolderCreateEventCallback>();

  public get onCreateInvoke() {
    return this._createSbj$.asObservable();
  }

  public create(fn: FolderCreateEventCallback) {
    this._createSbj$.next(fn);
  }
}
