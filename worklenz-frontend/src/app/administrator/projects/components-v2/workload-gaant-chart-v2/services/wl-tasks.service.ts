import {Injectable} from '@angular/core';
import {BehaviorSubject, Subject} from "rxjs";
import {
  IGroupByOption,
  ITaskListContextMenuEvent,
  ITaskListGroupChangeResponse
} from "../../../../modules/task-list-v2/interfaces";
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {ITaskPrioritiesGetResponse} from "@interfaces/api-models/task-priorities-get-response";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {Socket} from "ngx-socket-io";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {SocketEvents} from "@shared/socket-events";
import {IWLTaskListGroup} from "@interfaces/workload";
import {WlTasksHashMapService} from "./wl-tasks-hash-map.service";

@Injectable({
  providedIn: 'root'
})
export class WlTasksService {
  private readonly membersSbj$ = new Subject<void>();
  private readonly statusesSbj$ = new Subject<void>();
  private readonly prioritiesSbj$ = new Subject<void>();
  private readonly contextMenuSbj$ = new Subject<ITaskListContextMenuEvent>();
  private readonly taskAddOrDeleteSbj$ = new BehaviorSubject<ITaskListGroupChangeResponse | null>(null);
  private readonly phasesSbj$ = new Subject<void>();
  private readonly updateOverviewChartsSbj$ = new Subject<void>();
  private readonly removeMembersTaskSbj$ = new Subject<string>();
  private readonly refreshOnlyMembersSbj$ = new Subject<void>();
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

  public groups: IWLTaskListGroup[] = [];

  private _members: ITeamMemberViewModel[] = [];
  private _statuses: ITaskStatusViewModel[] = [];
  private _priorities: ITaskPrioritiesGetResponse[] = [];
  private _phases: ITaskPhase[] = [];

  public isSubtasksIncluded = false;

  public currentTab: "" | "end_date_null" | "start_date_null" | "start_end_dates_null" = "";

  private get _currentGroup(): IGroupByOption {
    const key = localStorage.getItem("worklenz.wltasklist.group_by");
    if (key) {
      const g = this.GROUP_BY_OPTIONS.find(o => o.value === key);
      if (g)
        return g;
    }
    return this.GROUP_BY_OPTIONS[0];
  }

  private set _currentGroup(option) {
    localStorage.setItem("worklenz.wltasklist.group_by", option.value);
  }

  public set members(value) {
    this._members = value;
    this.membersSbj$.next();
  }

  public get members() {
    return this._members;
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

  get onStatusesChange$() {
    return this.statusesSbj$.asObservable();
  }

  get onPrioritiesChange$() {
    return this.prioritiesSbj$.asObservable();
  }

  get onContextMenu$() {
    return this.contextMenuSbj$.asObservable();
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

  get updateOverviewCharts() {
    return this.updateOverviewChartsSbj$.asObservable();
  }

  get onRemoveMembersTask() {
    return this.removeMembersTaskSbj$.asObservable();
  }

  constructor(
    private readonly socket: Socket,
    private readonly map: WlTasksHashMapService
  ) {
  }

  public setCurrentGroup(group: IGroupByOption) {
    this._currentGroup = group;
  }

  public getCurrentGroup() {
    return this._currentGroup;
  }

  public onRefreshMembers() {
    return this.refreshOnlyMembersSbj$.asObservable();
  }

  public emitRefreshMembers() {
    this.refreshOnlyMembersSbj$.next();
  }

  public emitRefreshSubtasksIncluded() {
    this.refreshSubtasksIncludedSbj$.next();
  }


  public emitOnContextMenu(event: MouseEvent, task: IProjectTask) {
    this.contextMenuSbj$.next({event, task});
  }

  public emitTaskAddOrDelete(taskId: string, isSubTask: boolean) {
    this.taskAddOrDeleteSbj$.next({
      taskId: taskId,
      isSubTask: isSubTask
    });
  }

  public emitUpdateOverviewCharts() {
    this.updateOverviewChartsSbj$.next();
  }

  public emitRemoveMembersTask(taskId: string) {
    this.removeMembersTaskSbj$.next(taskId);
  }

  public getGroupIdByGroupedColumn(task: IProjectTask) {
    const groupBy = this.getCurrentGroup().value;
    if (groupBy === this.GROUP_BY_STATUS_VALUE)
      return task.status as string;

    if (groupBy === this.GROUP_BY_PRIORITY_VALUE)
      return task.priority as string;

    if (groupBy === this.GROUP_BY_PHASE_VALUE)
      return task.phase_id as string;

    return null;
  }

  public updateTaskGroup(task: IProjectTask, insert = true) {
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
    // Get the group id of the task.
    const groupId = this.map.getGroupId(taskId);
    if (!groupId || !taskId) return;

    // Find the group that contains the task.
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    // Get the task object from the list of selected tasks.
    const task = this.map.getSelectedTasks().find(t => t.id === taskId);

    // If the task is a sub-task, remove it from its parent task's sub-tasks list.
    if (task?.is_sub_task) {
      const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
      if (parentTask) {
        // Find the index of the sub-task in the parent task's sub-tasks list.
        const index = parentTask.sub_tasks?.findIndex(t => t.id === task.id);
        if (typeof index !== "undefined" && index !== -1) {
          if (!parentTask.sub_tasks_count) parentTask.sub_tasks_count = 0;
          parentTask.sub_tasks_count = Math.max(+parentTask.sub_tasks_count - 1, 0);
          parentTask.sub_tasks?.splice(index, 1);
          this.emitTaskAddOrDelete(parentTask.id as string, true);
        }
      }
      this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parentTask?.id);
      this.map.remove(task);
    } else { // If the task is not a sub-task, remove it from the group's task list.
      const taskIndex = index ?? group.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        this.map.remove(group.tasks[taskIndex]);
        group.tasks.splice(taskIndex, 1);
        this.emitTaskAddOrDelete(taskId, false);
      }
    }

    // Deselect all tasks after removing the task.
    this.map.deselectAll();
  }

  public addTask(task: IProjectTask, groupId: string, insert = false) {
    const group = this.groups.find(g => g.id === groupId);
    if (group && task.id) {
      // Add the task to the group's task array
      if (insert) {
        group.tasks.unshift(task);
      } else {
        group.tasks.push(task);
      }
      this.map.add(groupId, task);
      this.emitTaskAddOrDelete(task.parent_task_id as string, !!task.parent_task_id);
    }
  }

  public reset() {
    this._members = [];
    this._statuses = [];
    this._priorities = [];

    this.groups = [];
    this.isSubtasksIncluded = false;
  }
}
