import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {UtilsService} from "@services/utils.service";
import {filter, Subject, takeUntil} from "rxjs";
import {TaskTimerService} from "@admin/components/task-timer/task-timer.service";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {AuthService} from "@services/auth.service";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";

@Component({
  selector: 'worklenz-task-timer',
  standalone: true,
  imports: [CommonModule, NzIconModule, NzButtonModule, NzTypographyModule],
  templateUrl: './task-timer.component.html',
  styleUrls: ['./task-timer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskTimerComponent implements OnInit, OnDestroy {
  private readonly DEFAULT_TIME_LEFT = this.buildTimeString(0, 0, 0);

  @Output() onStart = new EventEmitter();
  @Output() onStop = new EventEmitter();
  @Output() changeListTime = new EventEmitter<number>();
  @Output() changeListTimeToDefault = new EventEmitter<number>();

  @Input() taskId!: string;
  @Input() projectId!: string;
  @Input() timerStartTime: number | null = null;

  started = false;
  startTime = 0;
  timeString = this.DEFAULT_TIME_LEFT;
  timer: null | number = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly utils: UtilsService,
    private readonly service: TaskTimerService,
    private readonly viewService: TaskViewService,
    private readonly auth: AuthService
  ) {
    this.service.onStart
      .pipe(
        filter(value => value.task_id === this.taskId),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.startTimer(value.start_time);
        this.cdr.markForCheck();
      });

    this.service.onStop
      .pipe(
        filter(value => value.task_id === this.taskId),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.stopTimer();
        this.cdr.markForCheck();
      });
  }

  ngOnInit() {
    this.startTime = 0;
    this.timer = null;
    if (this.timerStartTime) {
      this.startTimer(this.timerStartTime || Date.now());
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  quickAssignMember(session: ILocalSession) {
    const task = this.viewService.model.task;
    if (!task) return;
    const body = {
      team_member_id: session.team_member_id,
      project_id: this.projectId,
      task_id: task.id,
      reporter_id: session?.id,
      mode: 0,
      parent_task: task.parent_task_id
    };
    this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
    this.socket.once(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), (response: ITaskAssigneesUpdateResponse) => {
      if (session.team_member_id) {
        this.viewService.emitTimeLogAssignMember(response);
        this.viewService.emitSingleMemberChange(session.team_member_id);
      }
    })
    this.cdr.markForCheck();
  }

  toggleTimer(event: MouseEvent) {
    if (this.started) {
      this.socket.once(SocketEvents.TASK_TIMER_STOP.toString(), () => {
        const session = this.auth.getCurrentSession();
        if (session) {
          const assignees = this.viewService.model.task?.assignees as string[];
          if (assignees) {
            if (!assignees.includes(session?.team_member_id as string)) this.quickAssignMember(session);
          } else {
            this.service.emitListTimerStop(this.taskId)
          }
        }
        this.onStop?.emit();
      });

      this.stopTimer();
    } else {
      this.socket.once(SocketEvents.TASK_TIMER_START.toString(), () => {
        this.onStart?.emit();
      });

      this.startTimer(this.timerStartTime || Date.now());
    }
    event.stopPropagation();
  }

  buildTimeString(hours: number, minutes: number, seconds: number) {
    return this.utils.buildTimeString(hours, minutes, seconds);
  }

  private startTimer(startTime: number) {
    if (this.viewService.model.task) this.viewService.model.task.timer_start_time = startTime;
    if (this.started) return;
    this.started = true;
    this.startTime = startTime;

    if (!this.timerStartTime) {
      this.socket.emit(SocketEvents.TASK_TIMER_START.toString(), JSON.stringify({
        task_id: this.taskId
      }));
    }

    this.timerTick();

    this.changeListTime.emit(startTime);

    this.timer = setInterval(() => {
      this.timerTick();
    }, 1000) as number;
  }

  private stopTimer() {
    if (typeof this.timer === "number")
      clearInterval(this.timer);

    this.socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({
      task_id: this.taskId
    }));

    this.started = false;
    this.timer = null;
    if (this.viewService.model.task) this.viewService.model.task.timer_start_time = 0;
    this.changeListTimeToDefault.emit(0);
    this.startTime = 0;
    this.timerStartTime = null;
    this.timeString = this.DEFAULT_TIME_LEFT;
  }

  private timerTick() {
    const now = Date.now();
    const diff = ~~((now - this.startTime) / 1000);
    const hours = ~~(diff / 3600);
    const minutes = ~~((diff % 3600) / 60);
    const seconds = diff % 60;

    this.timeString = this.buildTimeString(hours, minutes, seconds);
    this.cdr.detectChanges();
  }
}
