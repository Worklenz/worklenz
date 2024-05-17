import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit} from '@angular/core';
import moment from "moment";
import {IMyTask} from "@interfaces/my-tasks";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {HomepageService} from "../../../../homepage-service.service";
import {formatGanttDate} from "@shared/utils";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-due-date',
  templateUrl: './task-due-date.component.html',
  styleUrls: ['./task-due-date.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskDueDateComponent implements OnInit, OnDestroy {
  @Input() task: IMyTask | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly homePageService: HomepageService,
    private readonly auth: AuthService,
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.handleResponse);
  }

  private handleResponse = (response: {
    id: string;
    parent_task: string | null;
    end_date: string;
  }) => {
    if (response.id === this.task?.id) {
      this.task.end_date = response.end_date;
      if (this.homePageService.tasksViewConfig) this.homePageService.emitGetTasksWithoutLoading(this.homePageService.tasksViewConfig);
      this.cdr.markForCheck();
    }
  };

  handleEndDateChange(date: string, task: IMyTask) {
    this.socket.emit(
      SocketEvents.TASK_END_DATE_CHANGE.toString(), JSON.stringify({
        task_id: task.id,
        end_date: formatGanttDate(date) || null,
        parent_task: task.parent_task_id,
        time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
      }));
  }

  toggleHighlightCls(active: boolean, element: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      if (active) {
        // this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
      } else {
        // this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
      }
    });
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

  changeTaskTab() {
    if (!this.task?.id) return;
    const taskToRemove = this.homePageService.tasksModel.tasks.findIndex(item => item.id === this.task?.id);

    if (this.homePageService.tasksViewConfig?.current_tab === 'All') {
      return;
    }

    if (!this.task.end_date) {
      switch (this.homePageService.tasksViewConfig?.current_tab) {
        case 'Today':
          this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
          break;
        case 'Upcoming':
          this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
          break;
        case 'Overdue':
          this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
          break;
      }
      return;
    }

    if (this.task.end_date) {
      const dateToCheck = new Date(this.task.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateToCheck.toDateString() === today.toDateString()) {
        switch (this.homePageService.tasksViewConfig?.current_tab) {
          case 'Upcoming':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
          case 'Overdue':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
          case 'NoDueDate':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
        }
        return;
      } else if (dateToCheck > today) {
        switch (this.homePageService.tasksViewConfig?.current_tab) {
          case 'Today':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
          case 'Overdue':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
          case 'NoDueDate':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
        }
      } else if (dateToCheck < today) {
        switch (this.homePageService.tasksViewConfig?.current_tab) {
          case 'Today':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
          case 'Upcoming':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
          case 'NoDueDate':
            this.homePageService.tasksModel.tasks.splice(taskToRemove, 1)
            break;
        }
      }
    }
    this.cdr.markForCheck();
  }
}
