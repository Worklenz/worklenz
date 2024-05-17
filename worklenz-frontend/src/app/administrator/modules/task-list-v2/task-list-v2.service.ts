import {Injectable} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskPrioritiesGetResponse} from "@interfaces/api-models/task-priorities-get-response";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";
import {ITaskLabel} from "@interfaces/task-label";
import {ITaskListColumn} from "@interfaces/task-list-column";
import {BehaviorSubject, Subject} from "rxjs";
import {IGroupByOption, ITaskListContextMenuEvent, ITaskListGroup, ITaskListGroupChangeResponse} from "./interfaces";
import {TaskListHashMapService} from "./task-list-hash-map.service";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITaskPhase} from "@interfaces/api-models/task-phase";

@Injectable({
  providedIn: 'root'
})
export class TaskListV2Service {
  private readonly colsSbj$ = new Subject<void>();
  private readonly membersSbj$ = new Subject<void>();
  private readonly labelsSbj$ = new Subject<void>();
  private readonly statusesSbj$ = new Subject<void>();
  private readonly prioritiesSbj$ = new Subject<void>();
  private readonly contextMenuSbj$ = new Subject<ITaskListContextMenuEvent>();
  private readonly assignMeSbj$ = new Subject<ITaskAssigneesUpdateResponse>();
  private readonly taskAddOrDeleteSbj$ = new BehaviorSubject<ITaskListGroupChangeResponse | null>(null);
  private readonly refreshSbj$ = new Subject<void>();
  private readonly groupChangeSbj$ = new Subject<{ groupId: string; taskId: string; color: string; }>();
  private readonly inviteMemberSbj$ = new Subject<void>();
  private readonly phasesSbj$ = new Subject<void>();
  private readonly updateGroupProgressSbj$ = new Subject<{ taskId: string; }>();
  private readonly refreshSubtasksIncludedSbj$ = new Subject<void>();

  public readonly HIGHLIGHT_COL_CLS = 'highlight-col';

  public readonly COLUMN_KEYS = {
    KEY: "KEY",
    NAME: "NAME",
    DESCRIPTION: "DESCRIPTION",
    PROGRESS: "PROGRESS",
    ASSIGNEES: "ASSIGNEES",
    LABELS: "LABELS",
    STATUS: "STATUS",
    PRIORITY: "PRIORITY",
    TIME_TRACKING: "TIME_TRACKING",
    ESTIMATION: "ESTIMATION",
    START_DATE: "START_DATE",
    DUE_DATE: "DUE_DATE",
    COMPLETED_DATE: "COMPLETED_DATE",
    CREATED_DATE: "CREATED_DATE",
    LAST_UPDATED: "LAST_UPDATED",
    REPORTER: "REPORTER",
    PHASE: "PHASE"
  };

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
  public _cols: ITaskListColumn[] = [];
  private _members: ITeamMemberViewModel[] = [];
  private _labels: ITaskLabel[] = [];
  private _statuses: ITaskStatusViewModel[] = [];
  private _priorities: ITaskPrioritiesGetResponse[] = [];
  private _phases: ITaskPhase[] = [];

  public isSubtasksIncluded = false;

  private get _currentGroup(): IGroupByOption {
    const key = localStorage.getItem("worklenz.tasklist.group_by");
    if (key) {
      const g = this.GROUP_BY_OPTIONS.find(o => o.value === key);
      if (g)
        return g;
    }
    return this.GROUP_BY_OPTIONS[0];
  }

  private set _currentGroup(option) {
    localStorage.setItem("worklenz.tasklist.group_by", option.value);
  }

  public set columns(value) {
    this._cols = value;
    this.emitColsChange();
  }

  public get columns() {
    return this._cols;
  }

  public set members(value) {
    this._members = value;
    this.membersSbj$.next();
  }

  public get members() {
    return this._members;
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

  get onMembersChange$() {
    return this.membersSbj$.asObservable();
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

  get onAssignMe$() {
    return this.assignMeSbj$.asObservable();
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

  get onInviteClick$() {
    return this.inviteMemberSbj$.asObservable();
  }

  get onPhaseChange$() {
    return this.phasesSbj$.asObservable();
  }

  get onGroupProgressChangeDone$() {
    return this.updateGroupProgressSbj$.asObservable();
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
    private readonly map: TaskListHashMapService
  ) {
  }

  public canActive(key: string) {
    return !!this.columns.find(c => c.key === key)?.pinned;
  }

  public setProjectId(id: string) {
    this._projectId = id;
  }

  public getProjectId() {
    return this._projectId;
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

  public emitOnContextMenu(event: MouseEvent, task: IProjectTask) {
    this.contextMenuSbj$.next({event, task});
  }

  public emitOnAssignMe(res: ITaskAssigneesUpdateResponse) {
    this.assignMeSbj$.next(res);
  }

  public emitRefresh() {
    this.refreshSbj$.next();
  }

  public emitGroupChange(groupId: string, taskId: string, color: string) {
    this.groupChangeSbj$.next({groupId, taskId, color});
  }

  public emitInviteMembers() {
    this.inviteMemberSbj$.next();
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

  /**
   * Updates the task group for a given task.
   *
   * @param {IProjectTask} task - The task to update the group for.
   * @param {boolean} insert - Add the task to the beginning of the array
   * @returns {void}
   */
  public updateTaskGroup(task: IProjectTask, insert = true) {
    if (!task.id) return;

    /**
     * Retrieves the group ID based on the grouped column of the task.
     *
     * @param {IProjectTask} task - The task to determine the group ID for.
     * @returns {string | null} The group ID if found, or null if not applicable.
     */
    const groupId = this.getGroupIdByGroupedColumn(task);

    if (groupId) {
      // Delete the task from its current group
      this.deleteTask(task.id);

      // Add the task to the new group
      this.addTask(task, groupId, insert);
      this.emitUpdateGroupProgress(task.id);
    }
  }

  /**
   * Removes a task from the task list array, and also this performs delete from map
   * @param taskId The id of the task to remove.
   * @param index Task to be removed
   */
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

  /**
   * Adds a new task to the specified group.
   * If the task is a sub-task, it is added to the corresponding parent task's sub-task array.
   * Also adds to map
   * @param task The task to add
   * @param groupId The ID of the group to add the task to
   * @param insert Add the element to the beginning of the array
   */
  public addTask(task: IProjectTask, groupId: string, insert = false) {
    const group = this.groups.find(g => g.id === groupId);
    if (group && task.id) {
      // If the task is a sub-task
      if (task.parent_task_id) {
        // Find the parent task
        const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
        if (parentTask) {
          if (!parentTask.sub_tasks_count) parentTask.sub_tasks_count = 0;
          parentTask.sub_tasks_count = +parentTask.sub_tasks_count + 1;
          // Add the task to the parent task's sub-task array
          parentTask.sub_tasks?.push(task);

          this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parentTask?.id);
        }
      } else { // If the task is not a sub-task
        // Add the task to the group's task array
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
    this._members = [];
    this._labels = [];
    this._statuses = [];
    this._priorities = [];

    this._projectId = null;
    this.groups = [];
    this.isSubtasksIncluded = false;
  }
}
