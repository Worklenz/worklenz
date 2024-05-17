import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2
} from '@angular/core';
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import moment from "moment/moment";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {WlTasksService} from "../../services/wl-tasks.service";
import {formatGanttDate} from "@shared/utils";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-wl-end-date',
  templateUrl: './end-date.component.html',
  styleUrls: ['./end-date.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WLEndDateComponent implements OnInit, OnDestroy {
  @Input() task: IProjectTask = {};
  @HostBinding("class") cls = "flex-row task-due-date";

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly service: WlTasksService,
    private readonly renderer: Renderer2,
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
    if (response.id === this.task.id && this.task.end_date !== response.end_date) {
      this.task.end_date = response.end_date;
      this.cdr.markForCheck();
    }
  };

  handleEndDateChange(date: string, task: IProjectTask) {
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
        this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
      } else {
        this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
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

}
