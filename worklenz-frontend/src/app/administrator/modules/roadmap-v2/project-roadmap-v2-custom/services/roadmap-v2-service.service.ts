import {Injectable} from '@angular/core';
import {BehaviorSubject, Subject} from "rxjs";
import {IGroupByOption, ITaskListGroup, ITaskListGroupChangeResponse} from "../../../task-list-v2/interfaces";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {ITaskPrioritiesGetResponse} from "@interfaces/api-models/task-priorities-get-response";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {Socket} from "ngx-socket-io";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {SocketEvents} from "@shared/socket-events";
import {RoadmapV2HashmapService} from "./roadmap-v2-hashmap.service";
import {IDateVerificationResponse, ITaskDragResponse, ITaskResizeResponse} from "@interfaces/roadmap";
import moment, {Moment} from "moment";

@Injectable({
  providedIn: 'root'
})
export class RoadmapV2Service {
  private readonly statusesSbj$ = new Subject<void>();
  private readonly prioritiesSbj$ = new Subject<void>();
  private readonly taskAddOrDeleteSbj$ = new BehaviorSubject<ITaskListGroupChangeResponse | null>(null);
  private readonly refreshSbj$ = new Subject<void>();
  private readonly groupChangeSbj$ = new Subject<{ groupId: string; taskId: string; color: string; }>();
  private readonly phasesSbj$ = new Subject<void>();
  private readonly updateGroupProgressSbj$ = new Subject<{ taskId: string; }>();
  private readonly refreshSubtasksIncludedSbj$ = new Subject<void>();
  private readonly reCreateChartSbj$ = new Subject<boolean>();
  private readonly resizeEndSbj$ = new Subject<IDateVerificationResponse>();
  private readonly subTaskAddSbj$ = new Subject<string>();
  private readonly subTaskDeleteSbj$ = new Subject<string>();
  private readonly showIndicatorsSbj$ = new Subject<string>();
  private readonly removeIndicatorsSbj$ = new Subject<string>();

  public readonly HIGHLIGHT_COL_CLS = 'highlight-col';

  public readonly GROUP_BY_STATUS_VALUE = "status";
  public readonly GROUP_BY_PRIORITY_VALUE = "priority";
  public readonly GROUP_BY_PHASE_VALUE = "phase";
  public readonly GROUP_BY_OPTIONS: IGroupByOption[] = [
    {label: "Status", value: this.GROUP_BY_STATUS_VALUE},
    {label: "Priority", value: this.GROUP_BY_PRIORITY_VALUE},
    {label: "Phase", value: this.GROUP_BY_PHASE_VALUE}
  ];

  public groups: ITaskListGroup[] = [];

  private _projectId: string | null = null;
  private _statuses: ITaskStatusViewModel[] = [];
  private _priorities: ITaskPrioritiesGetResponse[] = [];
  private _phases: ITaskPhase[] = [];

  public isSubtasksIncluded = false;

  public offset = 0;

  public width = 0;
  public top = 0;
  public left = 0;
  public opacity = 0;
  public transition = 0.15;

  public highlighterLeft = 0;
  public highlighterWidth = 0;

  public chartStartDate: string | null = null;

  private get _currentGroup(): IGroupByOption {
    const key = localStorage.getItem("worklenz.roadmap.group_by");
    if (key) {
      const g = this.GROUP_BY_OPTIONS.find(o => o.value === key);
      if (g)
        return g;
    }
    return this.GROUP_BY_OPTIONS[0];
  }

  private set _currentGroup(option) {
    localStorage.setItem("worklenz.roadmap.group_by", option.value);
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

  get onGroupChange$() {
    return this.groupChangeSbj$.asObservable();
  }

  set statuses(value) {
    this._statuses = value;
    this.statusesSbj$.next();
  }

  get statuses() {
    return this._statuses;
  }

  get onReCreateChart() {
    return this.reCreateChartSbj$.asObservable();
  }

  get onResizeEnd() {
    return this.resizeEndSbj$.asObservable();
  }

  get onShowIndicators() {
    return this.showIndicatorsSbj$.asObservable();
  }

  get onRemoveIndicators() {
    return this.removeIndicatorsSbj$.asObservable();
  }

  constructor(
    private readonly socket: Socket,
    private readonly map: RoadmapV2HashmapService
  ) {
  }

  public setProjectId(id: string) {
    this._projectId = id;
  }

  public getProjectId() {
    return this._projectId;
  }

  get onSubtaskAdd() {
    return this.subTaskAddSbj$.asObservable();
  }

  get onSubtaskDelete() {
    return this.subTaskDeleteSbj$.asObservable();
  }

  public setCurrentGroup(group: IGroupByOption) {
    this._currentGroup = group;
  }

  public getCurrentGroup() {
    return this._currentGroup;
  }

  public emitRefresh() {
    this.refreshSbj$.next();
  }

  public emitTaskAddOrDelete(taskId: string, isSubTask: boolean) {
    this.taskAddOrDeleteSbj$.next({
      taskId: taskId,
      isSubTask: isSubTask
    });
  }

  public emitUpdateGroupProgress(taskId: string) {
    this.updateGroupProgressSbj$.next({taskId});
  }

  public emitRefreshSubtasksIncluded() {
    this.refreshSubtasksIncludedSbj$.next();
  }

  public emitReCreateChart(loading: boolean) {
    this.reCreateChartSbj$.next(loading);
  }

  public emitResizeEnd(response: IDateVerificationResponse) {
    this.resizeEndSbj$.next(response);
  }

  public emitSubTaskAdd(parentTask: string) {
    this.subTaskAddSbj$.next(parentTask);
  }

  public emitSubTaskDelete(parentTask: string) {
    this.subTaskDeleteSbj$.next(parentTask);
  }

  public emitShowIndicators(taskId: string) {
    this.showIndicatorsSbj$.next(taskId)
  }

  public emitRemoveIndicators(taskId: string) {
    this.removeIndicatorsSbj$.next(taskId)
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
      this.emitUpdateGroupProgress(task.id);
    }
  }

  public toggleGroupExpansion(groupId: string) {
    if (!groupId) return;

    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    group.is_expanded = !group.is_expanded;
    this.groups.forEach((others) => {
      if (others !== group) {
        others.is_expanded = false;
      }
    })

  }

  public handleTaskDragFinish(dragResponse: ITaskDragResponse) {
    if (!dragResponse.task_id) return;

    if (this.map.tasks.has(dragResponse.task_id)) {
      const task_ = this.map.tasks.get(dragResponse.task_id as string);
      if (!task_) return;

      task_.width = dragResponse.task_width;
      task_.offset_from = dragResponse.task_offset;
      task_.start_date = dragResponse.start_date;
      task_.end_date = dragResponse.end_date;
    }
    this.transition = 0.15;
  }

  public handleStartDateChange(resizeResponse: ITaskResizeResponse, chartStartDate: Moment, chartEndDate: Moment) {
    if (!resizeResponse.id) return;

    if (resizeResponse.start_date) {
      const fTaskStartDate = moment(resizeResponse.start_date).format("YYYY-MM-DD");
      const taskStartDate = moment(fTaskStartDate);
      if (taskStartDate.isBefore(chartStartDate) || taskStartDate.isSameOrAfter(chartEndDate)) {
        return this.emitReCreateChart(true);
      }
    }

    if (this.map.tasks.has(resizeResponse.id)) {
      const task = this.map.tasks.get(resizeResponse.id as string);
      if (!task) return;

      const body: IDateVerificationResponse = {
        task: task,
        taskStartDate: resizeResponse.start_date,
        taskEndDate: resizeResponse.end_date,
        chartStartDate: chartStartDate,
      }
      this.emitResizeEnd(body);
    }

  }

  public handleEndDateChange(resizeResponse: ITaskResizeResponse, chartStartDate: Moment, chartEndDate: Moment) {
    if (!resizeResponse.id) return;

    if (resizeResponse.end_date) {
      const fTaskEndDate = moment(resizeResponse.end_date).format("YYYY-MM-DD");
      const taskEndDate = moment(fTaskEndDate);
      if (taskEndDate.isSameOrAfter(chartEndDate)) {
        return this.emitReCreateChart(true);
      }
    }

    if (this.map.tasks.has(resizeResponse.id)) {
      const task = this.map.tasks.get(resizeResponse.id as string);
      if (!task) return;

      const body: IDateVerificationResponse = {
        task: task,
        taskStartDate: resizeResponse.start_date,
        taskEndDate: resizeResponse.end_date,
        chartStartDate: chartStartDate,
      }
      this.emitResizeEnd(body);
    }
  }

  public onGroupChange(taskId: string, toGroup: string) {
    if (!taskId || !toGroup) return;

    const task = this.map.tasks.get(taskId);
    if (!task || !task.id || task.parent_task_id) return;

    this.deleteTask(task.id);
    this.addTask(task, toGroup, true);

  }

  public deleteSubtaskFromView(taskId: string) {
    const task = this.map.tasks.get(taskId);
    if (!task) return;
    this.map.selectTask(task);
    this.deleteTask(taskId);
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
          this.emitSubTaskDelete(parentTask.id as string);
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

  public addSubtaskFromView(task: IProjectTask) {
    if (!task.parent_task_id) return;

    const groupId = this.map.getGroupId(task.parent_task_id);
    if (!groupId) return;

    task.width = 35;
    task.offset_from = this.offset;

    this.addTask(task, groupId, true);

  }

  public addTask(task: IProjectTask, groupId: string, insert = false) {
    const group = this.groups.find(g => g.id === groupId);
    if (group && task.id) {
      if (task.parent_task_id) {
        const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
        if (parentTask) {
          if (!parentTask.sub_tasks_count) parentTask.sub_tasks_count = 0;
          parentTask.sub_tasks_count = +parentTask.sub_tasks_count + 1;
          parentTask.sub_tasks?.push(task);
          this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parentTask?.id);
          this.emitSubTaskAdd(task.parent_task_id)
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
    this._statuses = [];
    this._priorities = [];

    this._projectId = null;
    this.groups = [];
    this.isSubtasksIncluded = false;
  }
}
