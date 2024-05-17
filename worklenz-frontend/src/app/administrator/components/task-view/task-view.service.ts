import {Injectable} from '@angular/core';
import {ITaskFormViewModel, ITaskViewModel} from "@interfaces/task-form-view-model";
import {ReplaySubject, Subject} from "rxjs";
import {ITaskViewTaskIds, ITaskViewTaskOpenRequest} from "@admin/components/task-view/interfaces";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";

@Injectable({
  providedIn: 'root'
})
export class TaskViewService {
  private readonly _selectTaskSbj$ = new Subject<string>();
  private readonly _selectSubTaskSbj$ = new Subject<IProjectTask>();
  private readonly _refreshSbj$ = new Subject<string>();
  private readonly _deleteSbj$ = new Subject<ITaskViewTaskIds>();
  private readonly _subTasksRefreshSbj$ = new ReplaySubject<void>();
  private readonly _commentsChangeSbj$ = new Subject<{ task: string; count: number; }>();
  private readonly _attachmentsChangeSbj$ = new Subject<{ task: string; count: number; }>();
  private readonly _taskSubscriberChangeSbj$ = new Subject<{ taskId: string; subscribers: number }>();
  private readonly _phaseChangeSbj$ = new Subject<void>();
  private readonly _statusChangeSbj$ = new Subject<void>();
  private readonly _endDateChangeSbj$ = new Subject<void>();
  private readonly _assigneesChangeSbj$ = new Subject<void>();
  private readonly _viewBackFromSbj$ = new Subject<ITaskViewModel>();
  private readonly _openTask$ = new ReplaySubject<ITaskViewTaskOpenRequest>();
  private readonly _singleMemberChangeSbj$ = new Subject<string>();
  private readonly _timeLogMemberAssignSbj$ = new Subject<ITaskAssigneesUpdateResponse>();

  private _model: ITaskFormViewModel = {};

  get model(): ITaskFormViewModel {
    return this._model;
  }

  get onSelectTask() {
    return this._selectTaskSbj$.asObservable();
  }

  get onSelectSubTask() {
    return this._selectSubTaskSbj$.asObservable();
  }

  get onRefresh() {
    return this._refreshSbj$.asObservable();
  }

  get onDelete() {
    return this._deleteSbj$.asObservable();
  }

  get onTaskSubscriberChange$() {
    return this._taskSubscriberChangeSbj$.asObservable();
  }

  get onCommentsChange() {
    return this._commentsChangeSbj$.asObservable();
  }

  get onAttachmentsChange() {
    return this._attachmentsChangeSbj$.asObservable();
  }

  get onPhaseChange() {
    return this._phaseChangeSbj$.asObservable();
  }

  get onStatusChange() {
    return this._statusChangeSbj$.asObservable();
  }

  get onEndDateChange() {
    return this._endDateChangeSbj$.asObservable();
  }

  get onAssigneesChange() {
    return this._assigneesChangeSbj$.asObservable();
  }

  get onViewBackFrom() {
    return this._viewBackFromSbj$.asObservable();
  }

  get onOpenTask() {
    return this._openTask$.asObservable();
  }

  get onSingleMemberChange() {
    return this._singleMemberChangeSbj$.asObservable();
  }

  get onTimeLogAssignMember() {
    return this._timeLogMemberAssignSbj$.asObservable();
  }

  public onRefreshSubTasks() {
    return this._subTasksRefreshSbj$.asObservable();
  }

  public emitTaskSelect(taskId: string) {
    this._selectTaskSbj$.next(taskId);
  }

  public emitSubTaskSelect(task: IProjectTask) {
    this._selectSubTaskSbj$.next(task);
  }

  public emitRefresh(taskId: string) {
    this._refreshSbj$.next(taskId);
  }

  public emitSubTasksRefresh() {
    this._subTasksRefreshSbj$.next();
  }

  public emitCommentsChange(taskId: string, count: number) {
    this._commentsChangeSbj$.next({task: taskId, count});
  }

  public emitAttachmentsChange(taskId: string, count: number) {
    this._attachmentsChangeSbj$.next({task: taskId, count});
  }

  public emitDelete({id, parent_task_id, project_id}: { id: string, parent_task_id?: string, project_id: string }) {
    this._deleteSbj$.next({id, parent_task_id, project_id});
  }

  public emitOnTaskSubscriberChange(taskId: string, subscribers: number) {
    this._taskSubscriberChangeSbj$.next({taskId, subscribers});
  }

  public emitPhaseChange() {
    this._phaseChangeSbj$.next();
  }

  public emitStatusChange() {
    this._statusChangeSbj$.next();
  }

  public emitEndDateChange() {
    this._endDateChangeSbj$.next();
  }

  public emitAssigneesChange() {
    this._statusChangeSbj$.next();
  }

  public emitOnViewBackFrom(task: ITaskViewModel) {
    this._viewBackFromSbj$.next(task);
  }

  public emitOpenTask(req: ITaskViewTaskOpenRequest) {
    this._openTask$.next(req);
  }

  public emitSingleMemberChange(teamMemberId: string) {
    this._singleMemberChangeSbj$.next(teamMemberId);
  }

  public emitTimeLogAssignMember(response: ITaskAssigneesUpdateResponse) {
    this._timeLogMemberAssignSbj$.next(response);
  }

  public setModel(model: ITaskFormViewModel) {
    this._model = {...model};
  }

  public resetModel() {
    this._model = {};
  }
}
