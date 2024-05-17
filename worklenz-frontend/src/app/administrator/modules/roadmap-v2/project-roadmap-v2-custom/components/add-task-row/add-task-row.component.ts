import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import {Socket} from "ngx-socket-io";
import {AuthService} from "@services/auth.service";
import {RoadmapV2Service} from "../../services/roadmap-v2-service.service";
import {ITaskCreateRequest} from "@interfaces/api-models/task-create-request";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {DEFAULT_TASK_NAME, UNMAPPED} from "@shared/constants";
import {log_error} from "@shared/utils";
import {SocketEvents} from "@shared/socket-events";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";

@Component({
  selector: 'worklenz-add-task-row',
  templateUrl: './add-task-row.component.html',
  styleUrls: ['./add-task-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddTaskRowComponent {
  @ViewChild('taskInput', {static: false}) taskInput!: ElementRef<HTMLInputElement>;
  @Input() projectId: string | null = null;
  @Input() parentTask: string | null = null;
  @Input() groupId: string | null = null;
  @Input({required: true}) chartStart: string | null = null;
  @Output() openTask = new EventEmitter<IProjectTask>();

  left: number = 0;
  width: number = 0;

  private readonly _session: ILocalSession | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly service: RoadmapV2Service,
  ) {
    this._session = this.auth.getCurrentSession();
  }

  onDragStart(event: MouseEvent) {
    this.left = event.offsetX - (event.offsetX % 35);
    const pageX = event.pageX;
    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.pageX - pageX;
      requestAnimationFrame(() => {
        this.width = deltaX;
        this.service.highlighterWidth = this.width;
        this.service.highlighterLeft = this.left;
        this.cdr.markForCheck();
      });
    };
    const onMouseUp = (event: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (pageX > event.pageX) {
        this.width = 0;
        this.left = 0;
        this.cdr.markForCheck();
        return;
      }
      requestAnimationFrame(() => {
        this.width = this.width + (35 - (this.width % 35));
        this.service.highlighterWidth = this.width;
        this.service.highlighterLeft = this.left;
        this.cdr.markForCheck();
        this.createTask();
      })
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  createTask() {
    if (!this.projectId || !this._session) return;
    const body = this.createRequest();
    try {
      this.socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
      this.socket.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
        this.onNewTaskReceived(task);
        if (task.parent_task_id) {
          this.service.emitUpdateGroupProgress(task.id as string);
        }
      });
    } catch (e) {
      log_error(e)
    }
  }

  private createRequest() {
    if (!this.projectId || !this._session) return null;
    const sess = this._session;
    const body: ITaskCreateRequest = {
      name: DEFAULT_TASK_NAME,
      project_id: this.projectId,
      reporter_id: sess.id,
      team_id: sess.team_id,
      chart_start: this.chartStart ? this.chartStart : '',
      width: this.width,
      offset: this.left,
      is_dragged: true
    };
    const groupBy = this.service.getCurrentGroup();
    if (groupBy.value === this.service.GROUP_BY_STATUS_VALUE) {
      body.status_id = this.groupId || undefined;
    } else if (groupBy.value === this.service.GROUP_BY_PRIORITY_VALUE) {
      body.priority_id = this.groupId || undefined;
    } else if (groupBy.value === this.service.GROUP_BY_PHASE_VALUE) {
      body.phase_id = this.groupId || undefined;
    }
    if (this.parentTask) {
      body.parent_task_id = this.parentTask;
    }
    return body;
  }

  onNewTaskReceived(task: IProjectTask) {
    task.width = this.width;
    task.offset_from = this.left;
    let groupId = this.service.getGroupIdByGroupedColumn(task);
    if (this.isGroupByPhase()) {
      if (!groupId) {
        groupId = UNMAPPED
      }
    }
    if (groupId) this.service.addTask(task, groupId);
    this.openTask.emit(task);
    this.cdr.markForCheck();
    this.reset();
  }

  private isGroupByPhase() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_PHASE_VALUE;
  }

  reset() {
    this.left = 0;
    this.width = 0;
  }

}
