import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {FormBuilder, FormGroup} from "@angular/forms";
import {ITaskLogViewModel} from "@interfaces/api-models/task-log-create-request";
import {UtilsService} from "@services/utils.service";
import {TasksLogTimeService} from "@api/tasks-log-time.service";
import {AppService} from "@services/app.service";
import {log_error} from "@shared/utils";
import {IServerResponse} from "@interfaces/api-models/server-response";
import moment from "moment/moment";
import {NzInputNumberComponent} from "ng-zorro-antd/input-number";
import {AuthService} from "@services/auth.service";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITimerStopEventResponse} from "@interfaces/timer-stop-event-response";
import {dispatchTasksChange} from "@shared/events";
import {TaskTimerService} from "@admin/components/task-timer/task-timer.service";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";
import {differenceInCalendarDays} from 'date-fns';
import {NzTimePickerComponent} from "ng-zorro-antd/time-picker";
import momentTime from "moment-timezone";

@Component({
  selector: 'worklenz-task-view-time-log',
  templateUrl: './task-view-time-log.component.html',
  styleUrls: ['./task-view-time-log.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewTimeLogComponent implements OnInit, OnDestroy {
  @ViewChild("hoursInput", {static: false}) hoursInput!: NzInputNumberComponent;
  @ViewChild("startInput", {static: false}) startInput!: NzTimePickerComponent;

  @Input() taskId: string | null = null;
  @Input() parentTaskId!: string | undefined;

  @Input() timerStartTime: number | null = null;
  @Input() projectId: string | null = null;

  form!: FormGroup;

  max = 1000;
  min = 0;

  loading = false;
  loadingLogs = false;
  showForm = false;
  exporting = false;
  errorDatePair = false;

  errorText = ""

  editId: string | null = null;

  timeLogs: ITaskLogViewModel[] = [];

  private _totalLogged = 0;

  disabledStartHours = () => {
    if (this.form.value.end) {
      const top = new Date(this.form.value.end).getHours() + 1;
      const body: number[] = [];
      for (let i = top; i <= 24; i++) {
        body.push(i);
      }
      return body;
    }
    return [];
  };

  disabledStartMinutes = (endHour: number) => {
    if (this.form.value.end) {
      const hour = new Date(this.form.value.end).getHours();
      const body: number[] = [];
      if (endHour === hour) {
        const top = new Date(this.form.value.end).getMinutes();
        for (let i = top; i <= 60; i++) {
          body.push(i);
        }
      }
      return body;
    }
    return [];
  };

  disabledEndHours = () => {
    if (this.form.value.start) {
      const top = new Date(this.form.value.start).getHours() - 1;
      const body: number[] = [];
      for (let i = 0; i <= top; i++) {
        body.push(i);
      }
      return body;
    }
    return [];
  };

  disabledEndMinutes = (startHour: number) => {
    if (this.form.value.start) {
      const hour = new Date(this.form.value.start).getHours();
      const body: number[] = [];
      if (startHour === hour) {
        const top = new Date(this.form.value.start).getMinutes();
        for (let i = 0; i <= top; i++) {
          body.push(i);
        }
      }
      return body;
    }
    return [];
  };

  compareDates() {
    if (this.form.value.start && this.form.value.end) {

      const momentStartTime = moment({
        year: 2000,
        month: 1,
        day: 1,
        hour: new Date(this.form.value.start).getHours(),
        minute: new Date(this.form.value.start).getMinutes(),
        second: 0
      });

      const momentEndTime = moment({
        year: 2000,
        month: 1,
        day: 1,
        hour: new Date(this.form.value.end).getHours(),
        minute: new Date(this.form.value.end).getMinutes(),
        second: 0
      });

      if (momentStartTime.isAfter(momentEndTime, 'minute')) {
        this.errorText = "Start time cannot be larger than End time.";
        this.errorDatePair = true;
        this.cdr.markForCheck();
        return true;
      }

      // if (new Date(this.form.value.start) > new Date(this.form.value.end)) {
      //   this.errorText = "Start time cannot be larger than End time.";
      //   this.errorDatePair = true;
      //   this.cdr.markForCheck();
      //   return true;
      // }

      if (!this.form.value.date) {
        this.errorText = "Select date first.";
        this.errorDatePair = true;
        this.cdr.markForCheck();
        return true;
      }
      return false;
    }
    return true;
  }

  get totalLogged() {
    const duration = moment.duration(this._totalLogged, "seconds");
    return this.formatDuration(duration);
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: TasksLogTimeService,
    private readonly app: AppService,
    private readonly cdr: ChangeDetectorRef,
    public readonly service: TaskViewService,
    private readonly auth: AuthService,
    private readonly socket: Socket,
    private readonly ngZone: NgZone,
    private readonly timerService: TaskTimerService,
    public readonly utils: UtilsService,
  ) {
    this.form = this.fb.group({
      description: [],
      date: [],
      start: [null],
      end: [null]
    });
  }

  ngOnInit(): void {
    void this.get();
    this.socket.on(SocketEvents.TASK_TIMER_STOP.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_TIMER_STOP.toString(), this.handleResponse);
    this.editId = null;
    this.timeLogs = [];
  }

  disabledDate = (current: Date): boolean =>
    differenceInCalendarDays(current, new Date()) > 0;

  quickAssignMember(session: ILocalSession) {
    const task = this.service.model.task;
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
        this.service.emitTimeLogAssignMember(response);
        this.service.emitSingleMemberChange(session.team_member_id);
      }
    })
    this.cdr.markForCheck();
  }

  async submit() {
    if (this.form.valid) {
      if (!this.taskId) return;
      if (this.compareDates()) return;
      try {
        this.loading = true;
        const session = this.auth.getCurrentSession();
        const assignees = this.service.model.task?.assignees as string[];
        if (session && !assignees.includes(session?.team_member_id as string)) this.quickAssignMember(session);

        const requestBody = await this.createReqBody();
        if (!requestBody) return;

        const res = this.editId
          ? await this.api.update(this.editId, this.mapToRequest(), requestBody)
          : await this.api.create(this.mapToRequest(), requestBody);
        if (res.done) {
          this.setFormVisibility(false);
          await this.get();
          this.timerService.emitSubmitOrUpdate();
        }
        this.loading = false;
      } catch (e) {
        log_error(e);
        this.loading = false;
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }

    this.cdr.detectChanges();
  }

  async get() {
    if (!this.taskId) return;
    try {
      this._totalLogged = 0;
      this.loadingLogs = true;
      const res = await this.api.getByTask(this.taskId, this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name as string : Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (res.done) {
        this.buildText(res);
        this.timeLogs = res.body;
      }
      this.loadingLogs = false;
    } catch (e) {
      this.loadingLogs = false;
    }

    this.cdr.detectChanges();
  }

  formatDuration(duration: moment.Duration) {
    const empty = "0h 0m";
    let format = "";

    if (duration.asMilliseconds() === 0) return empty;

    const h = ~~(duration.asHours());
    const m = duration.minutes();
    const s = duration.seconds();

    if (h === 0 && s > 0) {
      format = `${m}m ${s}s`;
    } else if (h > 0 && s === 0) {
      format = `${h}h ${m}m`;
    } else if (h > 0 && s > 0) {
      format = `${h}h ${m}m ${s}s`;
    } else {
      format = `${h}h ${m}m`;
    }

    return format;
  }

  private buildText(res: IServerResponse<ITaskLogViewModel[]>) {
    this._totalLogged = 0;
    for (const element of res.body) {
      const duration = moment.duration(element.time_spent, "seconds");
      element.time_spent_text = this.formatDuration(duration);
      this._totalLogged += parseFloat((element.time_spent || 0).toString());
    }
  }

  async delete(id?: string) {
    if (!id || !this.taskId) return;
    try {
      const res = await this.api.delete(id, this.taskId);
      if (res.done) {
        void this.get();
      }
    } catch (e) {
      // ignored
    }
  }

  private mapToRequest(): ITaskLogViewModel {
    return {
      id: this.taskId || undefined,
      project_id: this.projectId as string,
      start_time: this.form.value.start || null,
      end_time: this.form.value.end || null,
      description: this.form.value.description,
      created_at: this.form.value.date || null
    };
  }

  private async createReqBody() {
    const map = this.mapToRequest();
    if (!map.start_time || !map.end_time || !map.created_at) return;

    const createdAt = new Date(map.created_at);
    const startTime = moment(map.start_time);
    const endTime = moment(map.end_time);

    const formattedStartTime = moment({
      year: createdAt.getFullYear(),
      month: createdAt.getMonth(),
      day: createdAt.getDate(),
      hour: startTime.hours(),
      minute: startTime.minutes(),
      second: 0
    });

    const formattedEndTime = moment({
      year: createdAt.getFullYear(),
      month: createdAt.getMonth(),
      day: createdAt.getDate(),
      hour: endTime.hours(),
      minute: endTime.minutes(),
      second: 0,
    });

    const diff = formattedStartTime.diff(formattedEndTime, "seconds");

    return {
      id: this.taskId || undefined,
      project_id: this.projectId as string,
      formatted_start: formattedStartTime,
      seconds_spent: Math.floor(Math.abs(diff)),
      description: map.description,
    }

  }

  setFormVisibility(visible: boolean) {
    this.showForm = visible;
    if (visible) {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.startInput.focus();
        });
      });
    } else {
      this.form.reset();
      this.editId = null;
      this.errorText = "";
      this.errorDatePair = false;
    }
  }

  canDelete(userId?: string) {
    return this.auth.getCurrentSession()?.id === userId;
  }

  isValid() {
    // return this.form.value.hours > 0 || this.form.value.minutes > 0 || this.form.value.seconds > 0;
    return this.form.value.start && this.form.value.end;
  }

  async editRecord(record: ITaskLogViewModel) {
    if (!record.id) return;

    this.editId = record.id;

    this.form.setValue({
      start: record.start_time,
      end: record.end_time,
      description: record.description,
      date: record.created_at
    });
    this.setFormVisibility(true);
  }

  async exportExcel() {
    if (!this.taskId || this.exporting) return;
    try {
      this.exporting = true;
      this.api.exportExcel(this.taskId);
      this.exporting = false;
    } catch (e) {
      this.exporting = false;
    }

    this.cdr.detectChanges();
  }

  handleResponse = (response: ITimerStopEventResponse) => {
    if (response?.id === this.taskId) {
      void this.get();
    }
  }

  updateTaskList() {
    dispatchTasksChange();
  }

  emitStart(taskId: string) {
    this.timerService.emitStart(taskId, Date.now());
  }

  emitStop(taskId: string) {
    this.timerService.emitStop(taskId);
  }

  setTodayAsDefault() {
    this.form.setValue({
      date: momentTime.tz(new Date(), `${this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone}`).format("YYYY-MM-DD"),
      description: null,
      start: null,
      end: null,
    });
    this.setFormVisibility(true)
  }

}
