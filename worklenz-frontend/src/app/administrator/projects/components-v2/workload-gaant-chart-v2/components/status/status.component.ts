import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2
} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {Socket} from "ngx-socket-io";
import {WlTasksService} from "../../services/wl-tasks.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {filter} from "rxjs";
import {SocketEvents} from "@shared/socket-events";
import {ITaskListStatusChangeResponse} from "@interfaces/task-list-status-change-response";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-wl-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WLStatusComponent implements OnInit, OnDestroy {
  @Input({required: true}) task: IProjectTask = {};
  @HostBinding("class") cls = "flex-row task-status";

  statuses: ITaskStatusViewModel[] = [];
  loading = false;

  constructor(
    private readonly service: WlTasksService,
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly element: ElementRef,
    private readonly renderer: Renderer2,
    private readonly auth: AuthService,
  ) {
    this.service.onStatusesChange$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.updateStatuses();
        this.cdr.markForCheck();
      });
  }

  ngOnInit() {
    this.updateStatuses();
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleResponse);
  }

  private getTaskProgress(taskId: string) {
    this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), taskId);
  }

  private isGroupByStatus() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_STATUS_VALUE;
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  handleStatusChange(statusId: string, taskId?: string) {
    if (!taskId) return;

    this.socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      status_id: statusId,
      parent_task: this.task.parent_task_id,
team_id: this.auth.getCurrentSession()?.team_id
    }));

    this.getTaskProgress(taskId);
  }

  private handleResponse = (response: ITaskListStatusChangeResponse) => {
    if (response && response.id === this.task.id) {
      this.task.status_color = response.color_code;
      this.task.complete_ratio = +response.complete_ratio || 0;
      this.task.status = response.status_id;
      this.task.status_category = response.statusCategory;

      if (this.isGroupByStatus()) {
        this.service.updateTaskGroup(this.task, false);
        if (this.service.isSubtasksIncluded) {
          this.service.emitRefreshSubtasksIncluded();
        }
      }
      this.cdr.markForCheck();
    }
  }

  private updateStatuses() {
    this.statuses = this.service.statuses;
  }

  toggleHighlightCls(active: boolean, element: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      if (active) {
        this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
      } else {
        this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
      }
    });
  }

  handleOpen(open: boolean) {
    this.toggleHighlightCls(open, this.element.nativeElement);
  }

}
