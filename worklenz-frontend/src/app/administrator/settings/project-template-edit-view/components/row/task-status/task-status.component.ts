import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  Renderer2
} from '@angular/core';
import {IPTTask} from "../../../interfaces";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {PtTaskListService} from "../../../services/pt-task-list.service";
import {Socket} from "ngx-socket-io";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {filter} from "rxjs";
import {SocketEvents} from "@shared/socket-events";
import {ITaskListStatusChangeResponse} from "@interfaces/task-list-status-change-response";

@Component({
  selector: 'worklenz-task-status',
  templateUrl: './task-status.component.html',
  styleUrls: ['./task-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskStatusComponent {
  @Input() task: IPTTask = {};
  @HostBinding("class") cls = "flex-row task-status";

  statuses: ITaskStatusViewModel[] = [];

  loading = false;

  constructor(
    private readonly service: PtTaskListService,
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly element: ElementRef,
    private readonly renderer: Renderer2
  ) {
    this.service.onStatusesChange$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.updateStatuses();
        this.cdr.markForCheck();
      });

    this.service.onGroupChange$
      .pipe(
        filter(value => value.taskId === this.task.id),
        filter(() => this.isGroupByStatus()),
        takeUntilDestroyed()
      )
      .subscribe(value => {
        this.task.status = value.groupId;
        this.task.status_color = value.color;
        this.cdr.markForCheck();
      });
  }


  ngOnInit() {
    this.updateStatuses();
    this.socket.on(SocketEvents.PT_TASK_STATUS_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PT_TASK_STATUS_CHANGE.toString(), this.handleResponse);
  }

  private isGroupByStatus() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_STATUS_VALUE;
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  handleStatusChange(statusId: string, taskId?: string) {
    if (!taskId) return;

    this.socket.emit(SocketEvents.PT_TASK_STATUS_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      status_id: statusId,
      parent_task: this.task.parent_task_id
    }));
  }

  private handleResponse = (response: ITaskListStatusChangeResponse) => {
    if (response && response.id === this.task.id) {
      this.task.status_color = response.color_code;
      this.task.status = response.status_id;
      this.task.status_category = response.statusCategory;

      if (this.isGroupByStatus()) {
        if (!this.task.is_sub_task) {
          this.service.updateTaskGroup(this.task, false);
        }
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
