import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  Output,
  ViewChild
} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {smallId} from "@shared/utils";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {Socket} from "ngx-socket-io";
import {AuthService} from "@services/auth.service";
import {ITaskCreateRequest} from "@interfaces/api-models/task-create-request";
import {SocketEvents} from "@shared/socket-events";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";
import {ProjectScheduleService} from "../../service/project-schedule-service.service";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";

@Component({
  selector: 'worklenz-task-add-input',
  templateUrl: './task-add-input.component.html',
  styleUrls: ['./task-add-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskAddInputComponent {
  @ViewChild('taskInput', {static: false}) taskInput!: ElementRef<HTMLInputElement>;
  readonly form!: FormGroup;

  @Input({required: true}) projectId: string | null = null;
  @Input({required: true}) teamMemberId: string | null = null;
  @Input({required: true}) chartStart: string | null = null;
  @Input() label = "Add Task";

  @Output() focusChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  taskInputVisible = false;
  creating = false;

  protected readonly id = smallId(4);

  private readonly _session: ILocalSession | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly auth: AuthService,
    private readonly fb: FormBuilder,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ProjectScheduleService
  ) {
    this.form = this.fb.group({
      name: [null, [Validators.required, Validators.pattern(/^(\s+\S+\s*)*(?!\s).*$/)]]
    });
    this._session = this.auth.getCurrentSession();
  }

  focusTaskInput() {
    this.taskInputVisible = true;
    this.focusChange.emit(this.taskInputVisible);

    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.taskInput?.nativeElement.focus();
        this.taskInput?.nativeElement.select();
      }, 100); // wait for the animation end
    });
  }

  addTaskInputBlur() {
    this.taskInputVisible = false;
    this.focusChange.emit(this.taskInputVisible);
  }

  async onInputBlur() {
    if (this.isValidInput()) {
      await this.addInstantTask();
      return;
    }
    this.addTaskInputBlur();
  }

  private createRequest() {
    if (!this.projectId || !this._session) return null;
    const sess = this._session;
    const body: ITaskCreateRequest = {
      name: this.form.value.name,
      project_id: this.projectId,
      reporter_id: sess.id,
      team_id: sess.team_id,
      chart_start: this.chartStart ? this.chartStart : ''
    };
    return body;
  }

  private isValidInput() {
    return this.form.valid && this.form.value.name.trim().length;
  }

  async addInstantTask() {
    if (this.creating) return;
    if (!this.projectId || !this._session) return;
    if (this.isValidInput()) {
      try {
        const req = this.createRequest();
        if (!req) return;
        this.creating = true;
        this.socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(req));
        this.socket.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
          this.creating = false;
          this.onNewTaskReceived(task);
        });
      } catch (e) {
        this.creating = false;
      }
      this.cdr.markForCheck();
    }
  }

  public reset(scroll = true) {
    this.creating = false;
    this.form.controls["name"].setValue(null);
    this.taskInputVisible = true;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.taskInput?.nativeElement.focus();
        if (scroll)
          window.scrollTo(0, document.body.scrollHeight);
      }, DRAWER_ANIMATION_INTERVAL); // wait for the animation end
    });
    this.cdr.markForCheck();
  }

  private onNewTaskReceived(task: IProjectTask) {
    if (!task || !this._session || !this.projectId || !this.teamMemberId) return;

    const body = {
      team_member_id: this.teamMemberId,
      project_id: this.projectId,
      task_id: task.id,
      reporter_id: this._session.id,
      mode: 0,
      parent_task: task.parent_task_id
    };

    this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
    this.socket.once(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), (response: ITaskAssigneesUpdateResponse) => {
      this.cdr.markForCheck();
    })
    this.reset(false);
  }
}
