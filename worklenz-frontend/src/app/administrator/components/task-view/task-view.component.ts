import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  Renderer2
} from '@angular/core';
import {TasksApiService} from "@api/tasks-api.service";
import {ITaskFormViewModel, ITaskViewModel} from "@interfaces/task-form-view-model";
import {ActivatedRoute, NavigationStart, ParamMap, Router} from "@angular/router";
import {TaskViewService} from "./task-view.service";
import {log_error, waitForSeconds} from "@shared/utils";
import {TaskListV2Service} from "../../modules/task-list-v2/task-list-v2.service";
import {TaskListHashMapService} from "../../modules/task-list-v2/task-list-hash-map.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {DEFAULT_TASK_NAME} from "@shared/constants";
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {TaskLabelsApiService} from "@api/task-labels-api.service";
import {filter, Observable, takeWhile} from "rxjs";
import {Socket} from 'ngx-socket-io';
import {SocketEvents} from '@shared/socket-events';
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ITaskViewTaskOpenRequest} from "@admin/components/task-view/interfaces";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";

@Component({
  selector: 'worklenz-task-view',
  templateUrl: './task-view.component.html',
  styleUrls: ['./task-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewComponent implements OnDestroy {
  private _show = false;
  get show(): boolean {
    return this._show;
  }
  @Input() set show(value: boolean) {
    if (value === this._show) return;
    this._show = value;
  }
  @Output() showChange: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Input() taskId: string | null = null;
  @Output() taskIdChange: EventEmitter<string | null> = new EventEmitter();
  @Input() projectId: string | null = null;
  @Input() selfResetTaskId = true;
  @Output() taskDeleted: EventEmitter<any> = new EventEmitter();
  get task() {
    return this.service.model.task;
  }

  loading = true;

  private readonly DRAWER_CLOSE_TIME = 100;
  readonly BODY_STYLE = {
    padding: 0,
    overflowX: 'hidden',
    overflowY: 'auto'
  };

  private onUrlChange: Observable<NavigationStart> | null = null;

  constructor(
    private readonly api: TasksApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly list: TaskListV2Service,
    private readonly map: TaskListHashMapService,
    private readonly labelsApi: TaskLabelsApiService,
    private readonly renderer: Renderer2,
    private readonly socket: Socket,
    private readonly kanbanService: KanbanV2Service,
    private readonly ngZone: NgZone,
    private readonly service: TaskViewService,
  ) {
    this.onUrlChange = this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ) as Observable<NavigationStart>;

    this.service.onSelectSubTask
      .pipe(takeUntilDestroyed())
      .subscribe((task: IProjectTask) => {
        if (task) {
          void this.handleTaskSelectFromView(task);
        }
      });

    this.service.onOpenTask
      .pipe(takeUntilDestroyed())
      .subscribe(req => {
        this.openTask(req);
      });

    this.service.onTimeLogAssignMember
      .pipe(takeUntilDestroyed())
      .subscribe( (response: ITaskAssigneesUpdateResponse) => {
        this.get();
    })

  }

  ngOnDestroy() {
    this.onUrlChange = null;
  }

  private init() {
    void this.get();
    void this.getLabels();
  }

  private async handleTaskSelectFromView(task: IProjectTask) {
    this.handleCancel();
    if (task) {
      await waitForSeconds();
      this.taskId = task.id as string;
      this.projectId = task.project_id as string;
      this.show = true;
      this.showChange.emit(true);
      this.cdr.detectChanges();
    }
  }

  onVisibilityChange(visible: boolean) {
    this.updateQueryParams(visible);
    if (visible) {
      // Wait for drawer animation to finish
      setTimeout(() => this.init(), this.DRAWER_CLOSE_TIME);
      this.hideDocumentOverflow();
      this.subscribeToUrlChange(visible);
    } else {
      this.deleteUntitledTask();
      this.service.resetModel();
      this.resetDocumentOverflow();
    }
  }

  private hideDocumentOverflow() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.renderer.setStyle(document.documentElement, "overflow", "hidden");
      }); // run outside the current stack
    });
  }

  private resetDocumentOverflow() {
    this.renderer.removeStyle(document.documentElement, "overflow");
  }

  private subscribeToUrlChange(visible: boolean) {
    if (this.onUrlChange)
      this.onUrlChange
        .pipe(takeWhile(() => !visible, false))
        .subscribe(this.onUrlChanged);
  }

  private deleteUntitledTask() {
    if (this.service.model.task?.name === DEFAULT_TASK_NAME) {
      void this.deleteTask();
    }
  }

  onUrlChanged = () => {
    setTimeout(() => {
      this.handleCancel();
    }, this.DRAWER_CLOSE_TIME); // wait for an animation end
  }

  private loadParentTaskIfAvailable(task: ITaskViewModel | undefined) {
    if (task?.is_sub_task && task.parent_task_id) {
      this.service.emitTaskSelect(task.parent_task_id);
    }
  }

  handleCancel() {
    if (this._show) {
      this._show = false;
      this.showChange.emit(this._show);
      if (this.selfResetTaskId) {
        this.taskId = null;
        this.taskIdChange.emit(null);
      }
      this.removeTaskQueryParam();
    }
  }

  protected async getLabels() {
    try {
      const res = await this.labelsApi.get();
      if (res.done)
        this.list.labels = res.body;
    } catch (e) {
      // ignored
    }
  }

  private async get() {
    try {
      this.loading = true;
      const res = await this.api.getFormViewModel(this.taskId, this.projectId);
      if (res.done) {
        this.handleResponse(res.body);
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }
    this.cdr.detectChanges();
  }

  private handleResponse(body: ITaskFormViewModel) {
    this.service.setModel(body);
    this.list.members = body.team_members as ITeamMemberViewModel[];
  }

  private removeParamFromUrl(paramMap: ParamMap, key: string) {
    if (!paramMap.has(key)) {
      return;
    }

    const queryParams: any = {};
    paramMap.keys.filter(k => k != key).forEach(k => (queryParams[k] = paramMap.get(k)));
    this.router.navigate([], {queryParams, replaceUrl: true, relativeTo: this.route});
  }

  private updateQueryParams(visible: boolean) {
    if (!this.taskId) return;
    if (visible) {
      void this.router.navigate(
        [],
        {
          relativeTo: this.route,
          queryParams: {task: this.taskId},
          queryParamsHandling: 'merge'
        });
    } else {
      this.removeTaskQueryParam();
    }
  }

  isSubTask() {
    return !!this.service.model.task?.is_sub_task;
  }

  async deleteTask() {
    const task = this.service.model.task;
    if (!task?.id) return;
    try {
      const res = await this.api.delete(task.id);
      if (res.done) {
        if (!task.is_sub_task) {
          if (this.map._subTasksMap.has(task.id)) {
            const subtasks = this.map._subTasksMap.get(task.id);
            if (subtasks) {
              for (const subtask of subtasks) {
                this.map.selectTask(subtask);
                if (subtask.id) {
                  this.list.removeSubtask(subtask?.id)
                }
              }
            }
          }
        } else {
          this.list.removeSubtask(task.id);
          this.kanbanService.emitDeleteSubTask({
            parent_task_id: task.parent_task_id
          });
          this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
        }

        const count = this.service.model.task?.sub_tasks_count || 0;
        if (this.service.model.task)
          this.service.model.task.sub_tasks_count = Math.max(count - 1, 0);


        if (task.sub_tasks) {
          if (this.map._subTasksMap.has(task.id)) {
            const subtasks = this.map._subTasksMap.get(task.id);
            if (subtasks) {
              for (const subtask of subtasks) {
                this.map.selectTask(subtask);
              }
            }
          }
        } else {
          this.map.selectTask(task as IProjectTask);
        }
        this.list.deleteTask(task.id);
        this.list.emitRefresh();

        this.service.emitDelete({id: task.id, parent_task_id: task.parent_task_id, project_id: this.projectId as string});
        this.service.emitRefresh(task.id);

        this.kanbanService.emitDeleteTask(task as IProjectTask);
        this.taskDeleted.emit({taskId: task.id});

        if (task.is_sub_task) {
          this.loadParentTaskIfAvailable(task);
        } else {
          this.handleCancel();
        }
      }
    } catch (e) {
      log_error(e);
    }
  }

  onBackClick() {
    const task = this.service.model?.task;
    if (task) {
      if (task.is_sub_task)
        this.loadParentTaskIfAvailable(task);
      this.service.emitOnViewBackFrom(task);
    }
  }

  private removeTaskQueryParam() {
    this.removeParamFromUrl(this.route.snapshot.queryParamMap, "task");
  }

  private openTask(req: ITaskViewTaskOpenRequest) {
    this.taskId = req.task_id;
    this.taskIdChange.emit(this.taskId);
    this.projectId = req.project_id;
    this.show = true;
    this.showChange.emit(true);
    this.cdr.markForCheck();
  }

}
