import {Injectable} from '@angular/core';
import {BehaviorSubject, Subject} from "rxjs";
import {IPTTask, IPTTaskListColumn, IPTTaskListContextMenuEvent, IPTTaskListGroup} from "../interfaces";
import {IGroupByOption, ITaskListGroupChangeResponse} from "../../../modules/task-list-v2/interfaces";
import {ITaskLabel} from "@interfaces/task-label";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {ITaskPrioritiesGetResponse} from "@interfaces/api-models/task-priorities-get-response";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {Socket} from "ngx-socket-io";
import {PtTaskListHashMapService} from "./pt-task-list-hash-map.service";

@Injectable({
  providedIn: 'root'
})
export class PtTaskListService {
  private readonly colsSbj$ = new Subject<void>();
  private readonly labelsSbj$ = new Subject<void>();
  private readonly statusesSbj$ = new Subject<void>();
  private readonly prioritiesSbj$ = new Subject<void>();
  private readonly contextMenuSbj$ = new Subject<IPTTaskListContextMenuEvent>();

  private readonly taskAddOrDeleteSbj$ = new BehaviorSubject<ITaskListGroupChangeResponse | null>(null);
  private readonly refreshSbj$ = new Subject<void>();
  private readonly groupChangeSbj$ = new Subject<{ groupId: string; taskId: string; color: string; }>();

  private readonly phasesSbj$ = new Subject<void>();
  private readonly updateGroupProgressSbj$ = new Subject<{ taskId: string; }>();
  private readonly refreshSubtasksIncludedSbj$ = new Subject<void>();

  public readonly HIGHLIGHT_COL_CLS = 'highlight-col';

  public readonly GROUP_BY_STATUS_VALUE = "status";
  public readonly GROUP_BY_PRIORITY_VALUE = "priority";
  public readonly GROUP_BY_PHASE_VALUE = "phase";
  public readonly GROUP_BY_OPTIONS: IGroupByOption[] = [
    {label: "Status", value: this.GROUP_BY_STATUS_VALUE},
    {label: "Priority", value: this.GROUP_BY_PRIORITY_VALUE},
    {label: "Phase", value: this.GROUP_BY_PHASE_VALUE}
  ];

  public groups: IPTTaskListGroup[] = [];

  private _templateId: string | null = null;
  public _cols: IPTTaskListColumn[] = [];
  private _labels: ITaskLabel[] = [];
  private _statuses: ITaskStatusViewModel[] = [];
  private _priorities: ITaskPrioritiesGetResponse[] = [];
  private _phases: ITaskPhase[] = [];

  public isSubtasksIncluded = false;

  private get _currentGroup(): IGroupByOption {
    const key = localStorage.getItem("worklenz.pt-t-list.group_by");
    if (key) {
      const g = this.GROUP_BY_OPTIONS.find(o => o.value === key);
      if (g)
        return g;
    }
    return this.GROUP_BY_OPTIONS[0];
  }

  private set _currentGroup(option) {
    localStorage.setItem("worklenz.pt-t-list.group_by", option.value);
  }


  public set columns(value) {
    this._cols = value;
    this.emitColsChange();
  }

  public get columns() {
    return this._cols;
  }

  public set labels(value) {
    this._labels = value;
    this.labelsSbj$.next();
  }

  public get labels() {
    return this._labels;
  }

  public set priorities(value) {
    this._priorities = value;
    this.prioritiesSbj$.next();
  }

  public get priorities() {
    return this._priorities;
  }

  public set phases(value) {
    this._phases = value;
    this.phasesSbj$.next();
  }

  public get phases() {
    return this._phases;
  }

  get onColumnsChange$() {
    return this.colsSbj$.asObservable();
  }

  get onLabelsChange$() {
    return this.labelsSbj$.asObservable();
  }

  get onStatusesChange$() {
    return this.statusesSbj$.asObservable();
  }

  get onPrioritiesChange$() {
    return this.prioritiesSbj$.asObservable();
  }

  get onContextMenu$() {
    return this.contextMenuSbj$.asObservable();
  }

  get onTaskAddOrDelete$() {
    return this.taskAddOrDeleteSbj$.asObservable();
  }

  get onGroupChange$() {
    return this.groupChangeSbj$.asObservable();
  }

  get onRefresh$() {
    return this.refreshSbj$.asObservable();
  }

  get onPhaseChange$() {
    return this.phasesSbj$.asObservable();
  }

  set statuses(value) {
    this._statuses = value;
    this.statusesSbj$.next();
  }

  get statuses() {
    return this._statuses;
  }

  get onRefreshSubtasksIncluded() {
    return this.refreshSubtasksIncludedSbj$.asObservable();
  }

  constructor(
    private readonly socket: Socket,
    private readonly map: PtTaskListHashMapService
  ) {
  }

  public settemplateId(id: string) {
    this._templateId = id;
  }

  public gettemplateId() {
    return this._templateId;
  }

  public setCurrentGroup(group: IGroupByOption) {
    this._currentGroup = group;
  }

  public getCurrentGroup() {
    return this._currentGroup;
  }

  public emitColsChange() {
    this.colsSbj$.next();
  }

  public emitOnContextMenu(event: MouseEvent, task: IPTTask) {
    this.contextMenuSbj$.next({event, task});
  }

  public emitRefresh() {
    this.refreshSbj$.next();
  }

  public emitGroupChange(groupId: string, taskId: string, color: string) {
    this.groupChangeSbj$.next({groupId, taskId, color});
  }

  public emitTaskAddOrDelete(taskId: string, isSubTask: boolean) {
    this.taskAddOrDeleteSbj$.next({
      taskId: taskId,
      isSubTask: isSubTask
    });
  }

  public emitRefreshSubtasksIncluded() {
    this.refreshSubtasksIncludedSbj$.next();
  }

  public getGroupIdByGroupedColumn(task: IPTTask) {
    const groupBy = this.getCurrentGroup().value;
    if (groupBy === this.GROUP_BY_STATUS_VALUE)
      return task.status as string;

    if (groupBy === this.GROUP_BY_PRIORITY_VALUE)
      return task.priority as string;

    if (groupBy === this.GROUP_BY_PHASE_VALUE)
      return task.phase_id as string;

    return null;
  }

  public updateTaskGroup(task: IPTTask, insert = true) {
    if (!task.id) return;
    const groupId = this.getGroupIdByGroupedColumn(task);
    if (groupId) {
      // Delete the task from its current group
      this.deleteTask(task.id);
      // Add the task to the new group
      this.addTask(task, groupId, insert);
    }
  }

  public deleteTask(taskId: string, index: number | null = null) {

    const groupId = this.map.getGroupId(taskId);
    if (!groupId || !taskId) return;

    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    const task = this.map.getSelectedTasks().find(t => t.id === taskId);
    if (task?.is_sub_task) {
      const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
      if (parentTask) {
        const index = parentTask.sub_tasks?.findIndex(t => t.id === task.id);
        if (typeof index !== "undefined" && index !== -1) {
          if (!parentTask.sub_tasks_count) parentTask.sub_tasks_count = 0;
          parentTask.sub_tasks_count = Math.max(+parentTask.sub_tasks_count - 1, 0);
          parentTask.sub_tasks?.splice(index, 1);
          this.emitTaskAddOrDelete(parentTask.id as string, true);
        }
      }
      this.map.remove(task);
    } else { // If the task is not a sub-task, remove it from the group's task list.
      const taskIndex = index ?? group.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        this.map.remove(group.tasks[taskIndex]);
        group.tasks.splice(taskIndex, 1);
        this.emitTaskAddOrDelete(taskId, false);
      }
    }
    this.map.deselectAll();
  }

  public removeSubtask(taskId: string, index: number | null = null) {
    const groupId = this.map.getGroupId(taskId);
    if (!groupId || !taskId) return;

    // Find the group that contains the task.
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    const taskIndex = index ?? group.tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      this.map.remove(group.tasks[taskIndex]);
      group.tasks.splice(taskIndex, 1);
    }

    this.map.deselectAll();
  }

  public addTask(task: IPTTask, groupId: string, insert = false) {
    const group = this.groups.find(g => g.id === groupId);
    if (group && task.id) {
      if (task.parent_task_id) {
        const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
        if (parentTask) {
          if (!parentTask.sub_tasks_count) parentTask.sub_tasks_count = 0;
          parentTask.sub_tasks_count = +parentTask.sub_tasks_count + 1;
          parentTask.sub_tasks?.push(task);
        }
      } else {
        if (insert) {
          group.tasks.unshift(task);
        } else {
          group.tasks.push(task);
        }
      }
      this.map.add(groupId, task);
      this.emitTaskAddOrDelete(task.parent_task_id as string, !!task.parent_task_id);
    }
  }

  public reset() {
    this._cols = [];
    this._labels = [];
    this._statuses = [];
    this._priorities = [];

    this._templateId = null;
    this.groups = [];
    this.isSubtasksIncluded = false;
  }

}
