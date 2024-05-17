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
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {smallId} from "@shared/utils";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {Socket} from "ngx-socket-io";
import {AuthService} from "@services/auth.service";
import {PtTaskListHashMapService} from "../../services/pt-task-list-hash-map.service";
import {PtTaskListService} from "../../services/pt-task-list.service";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzIconModule} from "ng-zorro-antd/icon";
import {SocketEvents} from "@shared/socket-events";
import {IPTTask, IPTTaskCreateRequest} from "../../interfaces";

@Component({
  selector: 'worklenz-add-task-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NzInputModule, NzIconModule],
  templateUrl: './add-task-input.component.html',
  styleUrls: ['./add-task-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddTaskInputComponent {
  @ViewChild('taskInput', {static: false}) taskInput!: ElementRef<HTMLInputElement>;
  readonly form!: FormGroup;

  @Input() subTaskInput = false;
  @Input() templateId: string | null = null;
  @Input() parentTask: string | null = null;
  @Input() groupId: string | null = null;
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
    private readonly service: PtTaskListService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly map: PtTaskListHashMapService,
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
    if (!this.templateId || !this._session) return null;

    const sess = this._session;
    const body: IPTTaskCreateRequest = {
      name: this.form.value.name,
      template_id: this.templateId,
      reporter_id: sess.id,
      team_id: sess.team_id
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

  private isValidInput() {
    return this.form.valid && this.form.value.name.trim().length;
  }

  async addInstantTask() {
    if (this.creating) return;
    if (!this.templateId || !this._session) return;

    if (this.isValidInput()) {
      try {
        const req = this.createRequest();
        if (!req) return;
        this.creating = true;
        this.socket.emit(SocketEvents.PT_QUICK_TASK.toString(), JSON.stringify(req));
        this.socket.once(SocketEvents.PT_QUICK_TASK.toString(), (task: IPTTask) => {
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

  private onNewTaskReceived(task: IPTTask) {
    if (this.groupId && task.id) {
      if (this.map.has(task.id)) return;
      this.service.addTask(task, this.groupId);
      this.reset(false);
    }
  }


}
