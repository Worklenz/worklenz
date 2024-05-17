import {ChangeDetectionStrategy, Component, ElementRef, ViewChild} from '@angular/core';
import {TaskViewService} from "../task-view.service";
import {UtilsService} from "@services/utils.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import moment from 'moment';
import {formatGanttDate} from "@shared/utils";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-view-due-date',
  templateUrl: './task-view-due-date.component.html',
  styleUrls: ['./task-view-due-date.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewDueDateComponent {
  @ViewChild('std_Section') std_Section!: ElementRef;

  private readonly START_DATE_SET_TEXT = "Show start date";
  private readonly START_DATE_RESET_TEXT = "Hide start date";

  currentDateToggleBtnText = this.START_DATE_SET_TEXT;

  showStartDateSection = false;

  constructor(
    private readonly socket: Socket,
    public readonly service: TaskViewService,
    public readonly utils: UtilsService,
    private readonly auth: AuthService,
  ) {
  }

  handleStartDateChange(startDate?: string) {
    const task = this.service.model.task;
    if (!task?.id) return;

    this.socket.once(SocketEvents.TASK_START_DATE_CHANGE.toString(), (task: { id: string; }) => {
      if (task?.id)
        this.service.emitRefresh(task.id);
    });

    this.socket.emit(
      SocketEvents.TASK_START_DATE_CHANGE.toString(), JSON.stringify({
        task_id: task.id,
        start_date: (startDate) || null,
        parent_task: task.parent_task_id,
        time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
      }));
  }

  handleEndDateChange(endDate?: string) {
    const task = this.service.model.task;
    if (!task?.id) return;

    this.socket.once(SocketEvents.TASK_END_DATE_CHANGE.toString(), (task: { id: string; }) => {
      if (task?.id)
        this.service.emitRefresh(task.id);
      this.service.emitEndDateChange();
    });

    this.socket.emit(
      SocketEvents.TASK_END_DATE_CHANGE.toString(), JSON.stringify({
        task_id: task.id,
        end_date: (endDate) || null,
        parent_task: task.parent_task_id,
        time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
      }));
  }

  showStartDate() {
    if (this.showStartDateSection) {
      this.showStartDateSection = false;
      this.currentDateToggleBtnText = this.START_DATE_SET_TEXT;
    } else {
      this.showStartDateSection = true;
      this.currentDateToggleBtnText = this.START_DATE_RESET_TEXT;
    }
  }

  checkForPastDate(endDate: any) {
    const formattedEndDate = moment(endDate).format('YYYY-MM-DD');
    return formattedEndDate < moment().format('YYYY-MM-DD');
  }

  checkForSoonDate(endDate: any) {
    const formattedEndDate = moment(endDate).format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    return formattedEndDate === moment().format('YYYY-MM-DD') || formattedEndDate === tomorrow;
  }
}
