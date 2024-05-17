import {ITaskViewTaskIds} from '@admin/components/task-view/interfaces';
import {Injectable} from '@angular/core';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {ITaskFormViewModel} from '@interfaces/task-form-view-model';
import {ReplaySubject, Subject} from 'rxjs';
import {ITaskListGroupChangeResponse} from '../task-list-v2/interfaces';
import {Socket} from 'ngx-socket-io';
import {Column} from './kanban-board/models/column.model';
import {ITaskStatus} from '@interfaces/task-status';
import {ITaskAssigneesUpdateResponse} from '@interfaces/task-assignee-update-response';

@Injectable({
  providedIn: 'root'
})
export class KanbanV2Service {
  private readonly _selectTaskSbj$ = new Subject<string>();
  private readonly _selectSubTaskSbj$ = new Subject<IProjectTask>();
  private readonly _refreshSbj$ = new Subject<string>();
  private readonly _deleteSbj$ = new Subject<ITaskViewTaskIds>();
  private readonly _subTasksRefreshSbj$ = new ReplaySubject<void>();
  private readonly _commentsChangeSbj$ = new Subject<{ task: string; count: number; }>();
  private readonly _attachmentsChangeSbj$ = new Subject<{ task: string; count: number; }>();
  private readonly taskAddOrDeleteSbj$ = new Subject<ITaskListGroupChangeResponse>();
  private readonly onCreateStatus$ = new Subject<ITaskStatus>();
  private readonly onCreateSubTask$ = new Subject<IProjectTask>();
  private readonly onDeleteTask$ = new Subject<IProjectTask>();
  private readonly onDeleteSubTaskSbj$ = new Subject<IProjectTask>();
  private readonly onAssignMembersSbj$ = new Subject<ITaskAssigneesUpdateResponse>();
  private readonly refreshGroupsSbj$ = new Subject<void>();

  public groups: Column[] | ITaskStatus[] = [];

  constructor(
    private readonly socket: Socket,
  ) {
  }

  private _model: ITaskFormViewModel = {};

  get model(): ITaskFormViewModel {
    return this._model;
  }

  get onCreateStatus() {
    return this.onCreateStatus$.asObservable();
  }

  get onCreateSubTask() {
    return this.onCreateSubTask$.asObservable();
  }

  get onDeleteSubTask() {
    return this.onDeleteSubTaskSbj$.asObservable();
  }

  get onDeleteTask() {
    return this.onDeleteTask$.asObservable();
  }

  get onAssignMembers() {
    return this.onAssignMembersSbj$.asObservable();
  }

  public emitOnCreateStatus(data: ITaskStatus) {
    this.onCreateStatus$.next(data);
  }

  public emitOnCreateSubTask(data: IProjectTask) {
    this.onCreateSubTask$.next(data);
  }

  public emitDeleteTask(data: IProjectTask) {
    this.onDeleteTask$.next(data);
  }

  public emitDeleteSubTask(data: IProjectTask) {
    this.onDeleteSubTaskSbj$.next(data);
  }

  public emitRefresh(taskId: string) {
    this._refreshSbj$.next(taskId);
  }

  public emitDelete({id, parent_task_id, project_id}: { id: string, parent_task_id?: string, project_id: string }) {
    this._deleteSbj$.next({id, parent_task_id, project_id});
  }

  public emitOnAssignMembers(data: ITaskAssigneesUpdateResponse) {
    this.onAssignMembersSbj$.next(data);
  }

  public emitRefreshGroups() {
    this.refreshGroupsSbj$.next();
  }

  public resetModel() {
    this._model = {};
  }

}
