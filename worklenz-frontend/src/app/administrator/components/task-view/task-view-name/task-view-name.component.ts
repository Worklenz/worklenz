import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild
} from '@angular/core';
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITaskViewModel} from "@interfaces/task-form-view-model";
import {TaskViewService} from "../task-view.service";
import {DEFAULT_TASK_NAME} from "@shared/constants";
import {ITaskListStatusChangeResponse} from "@interfaces/task-list-status-change-response";
import {TaskListV2Service} from "../../../modules/task-list-v2/task-list-v2.service";
import {
  RoadmapV2Service
} from "../../../modules/roadmap-v2/project-roadmap-v2-custom/services/roadmap-v2-service.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-view-name',
  templateUrl: './task-view-name.component.html',
  styleUrls: ['./task-view-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewNameComponent implements OnInit, OnDestroy {
  @ViewChild("input", {static: false}) input!: ElementRef<HTMLInputElement>;

  protected readonly MAX_LEN = 250;
  private readonly INPUT_FOCUSED_CLS = "input-focused";

  showTaskNameInput = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly ngZone: NgZone,
    private readonly renderer: Renderer2,
    public readonly service: TaskViewService,
    private readonly list: TaskListV2Service,
    private readonly roadmapService: RoadmapV2Service,
    private readonly auth: AuthService,
  ) {
  }

  ngOnInit(): void {
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleStatusChangeResponse);

    this.autoFocusNameForNewTasks();
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleStatusChangeResponse);
  }

  handleNameChange(task?: ITaskViewModel) {
    if (!task) return;
    this.socket.emit(SocketEvents.TASK_NAME_CHANGE.toString(), JSON.stringify({
      task_id: task.id,
      name: task.name,
      parent_task: task.parent_task_id
    }));
  }

  private handleNameChangeResponse = (response: { id: string; parent_task: string; name: string; }) => {
    if (!response || !this.service.model) return;
    if (this.service.model.task && this.service.model.task.name != response.name) {
      this.service.model.task.name = response.name;
      this.cdr.detectChanges();
    }

    this.service.emitRefresh(response.id);
  }

  handleStatusChange(statusId: string, task: ITaskViewModel) {
    this.socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), JSON.stringify({
      task_id: task.id,
      status_id: statusId,
      parent_task: task.parent_task_id,
      team_id: this.auth.getCurrentSession()?.team_id
    }));

    // to update the parent task's progress
    this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
    this.cdr.detectChanges();
  }

  private handleStatusChangeResponse = (response: ITaskListStatusChangeResponse) => {
    if (this.service.model?.task && response.color_code) {
      this.service.model.task.status_color = response.color_code;
      this.service.emitRefresh(response.id);
      this.service.emitStatusChange();
      if (this.list.getCurrentGroup().value === this.list.GROUP_BY_STATUS_VALUE && this.list.isSubtasksIncluded) {
        this.list.emitRefreshSubtasksIncluded();
      }
      if (this.list.getCurrentGroup().value === this.list.GROUP_BY_STATUS_VALUE && this.list.isSubtasksIncluded) {
        this.list.emitRefreshSubtasksIncluded();
      }
      if (this.roadmapService.getCurrentGroup().value === this.roadmapService.GROUP_BY_STATUS_VALUE) {
        this.roadmapService.onGroupChange(response.id, response.status_id as string)
      }
      this.cdr.markForCheck();
    }
  }

  private autoFocusNameForNewTasks() {
    if (this.service.model.task?.name === DEFAULT_TASK_NAME) {
      this.ngZone.runOutsideAngular(() => {
        this.showTaskNameInput = true;
        setTimeout(() => {
          this.input?.nativeElement.focus();
          this.input?.nativeElement.select();
        }, 100);
      });
    }
  }

  addFocusCls(input: HTMLInputElement) {
    this.renderer.addClass(input, this.INPUT_FOCUSED_CLS);
  }

  focusInput() {
    setTimeout(() => {
      this.input.nativeElement.focus();
    }, 50)
  }

  removeFocusCls(input: HTMLInputElement) {
    this.renderer.removeClass(input, this.INPUT_FOCUSED_CLS);
  }

  hasCls(input: HTMLInputElement) {
    return input.classList.contains(this.INPUT_FOCUSED_CLS);
  }
}
