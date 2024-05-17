import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    NgZone,
    OnInit,
    Output,
    ViewChild
} from '@angular/core';
import {IScheduleProjectMember} from "@interfaces/schedular";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {smallId} from "@shared/utils";
import {Socket} from "ngx-socket-io";
import {AuthService} from "@services/auth.service";
import {ScheduleMemberTasksService} from "../../service/schedule-member-tasks-service.service";
import {ScheduleMemberTasksHashmapService} from "../../service/schedule-member-tasks-hashmap-service.service";
import {ITaskCreateRequest} from "@interfaces/api-models/task-create-request";
import {SocketEvents} from "@shared/socket-events";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";

@Component({
    selector: 'worklenz-schedule-member-task-add-container',
    templateUrl: './member-task-add-container.component.html',
    styleUrls: ['./member-task-add-container.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberTaskAddContainerComponent implements OnInit {
    @ViewChild('taskInput', {static: false}) taskInput!: ElementRef<HTMLInputElement>;
    readonly form!: FormGroup;

    @Input({required: true}) teamMember: IScheduleProjectMember | null = null;
    @Input() projectId: string | null = null;
    @Input() groupId: string | null = null;
    @Input() label = "Add Task";

    @Output() focusChange: EventEmitter<boolean> = new EventEmitter<boolean>();

    taskInputVisible = false;
    creating = false;
    private session: ILocalSession | null = null;

    protected readonly id = smallId(4);

    private readonly _session: ILocalSession | null = null;

    get profile() {
        return this.auth.getCurrentSession();
    }

    constructor(
        private readonly socket: Socket,
        private readonly auth: AuthService,
        private readonly fb: FormBuilder,
        private readonly service: ScheduleMemberTasksService,
        private readonly ngZone: NgZone,
        private readonly cdr: ChangeDetectorRef,
        private readonly map: ScheduleMemberTasksHashmapService
    ) {
        this.form = this.fb.group({
            name: [null, [Validators.required, Validators.pattern(/^(\s+\S+\s*)*(?!\s).*$/)]]
        });
        this._session = this.auth.getCurrentSession();
    }

    ngOnInit() {
        this.session = this.auth.getCurrentSession();
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
        const task_assign_body = {
          team_member_id: this.teamMember?.team_member_id,
          project_id: task.project_id,
          task_id: task.id,
          reporter_id: this.session?.id,
          mode: 0,
        };
        this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(task_assign_body));
        this.socket.once(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), (response: ITaskAssigneesUpdateResponse) => {
          this.creating = false;
          this.onNewTaskReceived(task);
          this.cdr.markForCheck();
        });

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
  if (this.groupId && task.id) {
    if (this.map.has(task.id)) return;
    this.service.addTask(task, this.groupId);
    this.service.emitRefreshMembers();
    this.reset(false);
  }
}


}
