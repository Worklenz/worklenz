import {Injectable} from '@angular/core';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {Column} from './kanban-board/models/column.model';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class KanbanHashMapService {
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

  public registerGroup(group: Column) {
    for (const task of group.data) {
      this.add(group.id, task);
    }
  }

  public add(groupId: string, task: IProjectTask) {
    if (!task.id) return;
    this.updateGroupTaskMap(groupId, task.id);
    this._taskGroupIdsMap.set(task.id, groupId);
    this._allTasksMap.set(task.id, task);
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

}
