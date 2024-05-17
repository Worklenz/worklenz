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
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskCreateRequest} from "@interfaces/api-models/task-create-request";
import {AuthService} from "@services/auth.service";
import {SocketEvents} from "@shared/socket-events";
import {smallId} from "@shared/utils";
import {Socket} from "ngx-socket-io";
import {TaskListV2Service} from "../../task-list-v2.service";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NgIf, NgSwitch, NgSwitchCase} from "@angular/common";
import {NzInputModule} from "ng-zorro-antd/input";
import {TaskListHashMapService} from "../../task-list-hash-map.service";
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";
import {RoadmapV2Service} from "../../../roadmap-v2/project-roadmap-v2-custom/services/roadmap-v2-service.service";
import {
  ProjectScheduleService
} from "../../../../schedule/schedule-v2/projects-schedule/service/project-schedule-service.service";

@Component({
  selector: 'worklenz-task-list-add-task-input',
  templateUrl: './task-list-add-task-input.component.html',
  styleUrls: ['./task-list-add-task-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NzIconModule,
    NgIf,
    ReactiveFormsModule,
    NzInputModule,
    NgSwitch,
    NgSwitchCase
  ],
  standalone: true
})
export class TaskListAddTaskInputComponent {
  @ViewChild('taskInput', {static: false}) taskInput!: ElementRef<HTMLInputElement>;
  readonly form!: FormGroup;

  @Input() subTaskInput = false;
  @Input() projectId: string | null = null;
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
    private readonly service: TaskListV2Service,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly map: TaskListHashMapService,
    private readonly kanbanService: KanbanV2Service,
    private readonly roadMapService: RoadmapV2Service,
    private readonly scheduleService: ProjectScheduleService
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
    if (!this.projectId || !this._session) return;

    if (this.isValidInput()) {
      try {
        const req = this.createRequest();
        if (!req) return;

        this.creating = true;

        this.socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(req));
        this.socket.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
          this.creating = false;
          if (task.parent_task_id) {
            this.service.emitUpdateGroupProgress(task.id as string);
            this.kanbanService.emitOnCreateSubTask(task);
            this.roadMapService.addSubtaskFromView(task);
            // this.roadMapService.addTask(task, this.groupId as string, true)
          };
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
    if (this.groupId && task.id) {
      if (this.map.has(task.id)) return;

      this.service.addTask(task, this.groupId);
      this.reset(false);
    }
  }
}
