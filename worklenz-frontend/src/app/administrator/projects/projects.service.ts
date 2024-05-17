import {Injectable} from '@angular/core';
import {Subject} from "rxjs";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  public id: string | null = null;
  public projectOwnerTeamMemberId: string | null = null;
  private readonly newTaskCreatedSbj$ = new Subject<IProjectTask>();

  get onNewTaskCreated() {
    return this.newTaskCreatedSbj$.asObservable();
  }

  public emitNewTaskCreated(task: IProjectTask) {
    this.newTaskCreatedSbj$.next(task);
  }

}
