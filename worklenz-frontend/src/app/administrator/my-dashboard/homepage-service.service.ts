import {Injectable} from '@angular/core';
import {IHomeTasksConfig, IHomeTasksModel} from "./intefaces";
import {Subject} from "rxjs";
import {IMyTask} from "@interfaces/my-tasks";

@Injectable({
  providedIn: 'root'
})
export class HomepageService {
  private readonly onGetTasksSbj$ = new Subject<IHomeTasksConfig>();
  private readonly onGetTasksWithoutLoadingSbj$ = new Subject<IHomeTasksConfig>();
  private readonly onNewTaskReceiveSbj$ = new Subject<IMyTask>();
  private readonly onNewPersonalTaskReceiveSbj$ = new Subject<IMyTask>();
  private readonly onRemoveTaskSbj$ = new Subject<string>();

  tasksModel: IHomeTasksModel = {
    tasks: [],
    total: 0,
    today: 0,
    upcoming: 0,
    overdue: 0,
    no_due_date: 0
  };

  personal_tasks: IMyTask[] = [];

  tasksViewConfig: IHomeTasksConfig | null = null;

  loadingTasks = false;
  loadingPersonalTasks = false;

  get onGetTasks() {
    return this.onGetTasksSbj$.asObservable();
  }

  get onGetTasksWithoutLoading() {
    return this.onGetTasksSbj$.asObservable();
  }

  get newTaskReceived() {
    return this.onNewTaskReceiveSbj$.asObservable();
  }

  get newPersonalTaskReceived() {
    return this.onNewPersonalTaskReceiveSbj$.asObservable();
  }

  get removeTaskFromList() {
    return this.onRemoveTaskSbj$.asObservable();
  }

  public emitGetTasks(config: IHomeTasksConfig) {
    this.onGetTasksSbj$.next(config);
  }

  public emitGetTasksWithoutLoading(config: IHomeTasksConfig) {
    this.onGetTasksSbj$.next(config);
  }

  public emitNewTaskReceived(task: IMyTask) {
    this.onNewTaskReceiveSbj$.next(task);
  }

  public emitPersonalTaskReceived(task: IMyTask) {
    this.onNewPersonalTaskReceiveSbj$.next(task);
  }

  public emitRemoveTaskFromList(id: string) {
    this.onRemoveTaskSbj$.next(id);
  }
}
