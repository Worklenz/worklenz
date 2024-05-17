import {Injectable} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {Subject} from "rxjs";
import {ITaskListGroup} from "./interfaces";

@Injectable({
  providedIn: 'root'
})
export class TaskListHashMapService {
  private readonly _selectSbj$ = new Subject<IProjectTask>();
  private readonly _deselectSbj$ = new Subject<IProjectTask>();
  private readonly _deselectAllSbj$ = new Subject<void>();

  /** Map<group id, { [task id]: selected }> */
  private readonly _groupTaskMap = new Map<string, { [x: string]: boolean; }>();
  /** Map<task id, group id> */
  private readonly _taskGroupIdsMap = new Map<string, string>();
  /** Map<task id, Task> */
  private readonly _selectedTasksMap = new Map<string, IProjectTask>();
  /** Map<task id, Task> */
  private readonly _allTasksMap = new Map<string, IProjectTask>();
  /** Map<task id, [SubTasks] */
  public readonly _subTasksMap = new Map<string, IProjectTask[]>();

  private _selectedCount = 0;

  public get tasks() {
    return this._allTasksMap;
  }

  public get onSelect$() {
    return this._selectSbj$.asObservable();
  }

  public get onDeselect$() {
    return this._deselectSbj$.asObservable();
  }

  public get onDeselectAll$() {
    return this._deselectAllSbj$.asObservable();
  }

  public reset() {
    this._groupTaskMap.clear();
    this._taskGroupIdsMap.clear();
    this._selectedTasksMap.clear();
    this._allTasksMap.clear();
    this._subTasksMap.clear();
    this._selectedCount = 0;
  }

  public registerGroup(group: ITaskListGroup) {
    for (const task of group.tasks) {
      this.add(group.id, task);
    }
  }

  public add(groupId: string, task: IProjectTask) {
    if (!task.id) return;
    this.updateGroupTaskMap(groupId, task.id);
    this._taskGroupIdsMap.set(task.id, groupId);
    this._allTasksMap.set(task.id, task);

    if (task.parent_task_id) {
      this.updateSubtasksMap(task.parent_task_id, task)
    }

  }

  public addGroupTask(groupId: string, task: IProjectTask) {
    if (!task.id) return;
    this._taskGroupIdsMap.set(task.id, groupId);
  }

  public has(taskId: string) {
    return this._allTasksMap.has(taskId);
  }

  public remove(task: IProjectTask) {
    if (!task.id) return;
    this.deselectTask(task);
    this._taskGroupIdsMap.get(task.id);
    this._allTasksMap.delete(task.id);
  }

  private updateGroupTaskMap(groupId: string, taskId: string, selected?: boolean) {
    const map = this._groupTaskMap.get(groupId);
    if (map) {
      if (typeof selected === "boolean") {
        map[taskId] = selected;
      } else {
        delete map[taskId];
      }

      this._groupTaskMap.set(groupId, map);
    } else {
      this._groupTaskMap.set(groupId, {[taskId]: selected || false});
    }
  }

  private updateSubtasksMap(parentTaskId: string, task: IProjectTask, selected?: boolean) {
    const subtasks = this._subTasksMap.get(parentTaskId) || [];
    const isParentTaskAvailable = subtasks.some((subtask) => subtask.id === task.id);

    // Only push the subtask if the parent task is not available
    if (!isParentTaskAvailable) {
      subtasks.push(task);
      this._subTasksMap.set(parentTaskId, subtasks);
    }

  }

  public selectTask(task: IProjectTask) {
    if (this._selectedTasksMap.get(task.id as string)) return;

    this._selectedTasksMap.set(task.id as string, task);
    this._selectedCount++;

    this.updateGroupTaskMap(
      this._taskGroupIdsMap.get(task.id as string) as string,
      task.id as string,
      true
    );

    this._selectSbj$.next(task);

  }

  public deselectTask(task: IProjectTask) {
    if (this._selectedTasksMap.has(task.id as string)) {
      this._selectedTasksMap.delete(task.id as string);
      this._selectedCount--;

      this.updateGroupTaskMap(
        this._taskGroupIdsMap.get(task.id as string) as string,
        task.id as string,
        false
      );

      this._deselectSbj$.next(task);
    }
  }

  private deselectLocalGroups() {
    for (const [groupId, task] of this._groupTaskMap) {
      for (const taskId in task) {
        this.updateGroupTaskMap(groupId, taskId, false);
      }
    }
  }

  public deselectAll() {
    if (!this._selectedTasksMap.size) return;

    this.deselectLocalGroups();
    this._selectedTasksMap.clear();
    this._selectedCount = 0;

    this._deselectAllSbj$.next();
  }

  public isAllSelected(groupId: string) {
    const tasks = this._groupTaskMap.get(groupId);

    if (tasks) {
      for (const taskId in tasks)
        if (!tasks[taskId]) return false;
      return true;
    }

    return false;
  }

  public isAllDeselected(groupId: string) {
    const tasks = this._groupTaskMap.get(groupId);

    if (tasks) {
      for (const taskId in tasks)
        if (tasks[taskId]) return false;
    }

    return true;
  }

  public getSelectedCount() {
    return this._selectedCount;
  }

  public getGroupId(taskId: string) {
    return this._taskGroupIdsMap.get(taskId);
  }

  public getSelectedTasks() {
    const tasks = [];
    for (const [, task] of this._selectedTasksMap.entries()) {
      tasks.push(task);
    }
    return tasks;
  }

  public getSelectedTaskIds(): string[] {
    const tasks = [];
    for (const [taskId] of this._selectedTasksMap.entries()) {
      tasks.push(taskId);
    }
    return tasks;
  }
}
