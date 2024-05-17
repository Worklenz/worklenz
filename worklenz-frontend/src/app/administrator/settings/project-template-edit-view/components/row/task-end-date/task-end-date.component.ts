import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  NgZone,
  Renderer2
} from '@angular/core';
import {IPTTask} from "../../../interfaces";
import {PtTaskListService} from "../../../services/pt-task-list.service";
import moment from "moment";
import {Socket} from "ngx-socket-io";

@Component({
  selector: 'worklenz-task-end-date',
  templateUrl: './task-end-date.component.html',
  styleUrls: ['./task-end-date.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskEndDateComponent {
  @Input() task: IPTTask = {};
  @HostBinding("class") cls = "flex-row task-due-date";

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly service: PtTaskListService,
    private readonly renderer: Renderer2
  ) {
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

  handleEndDateChange(date: string, task: IPTTask) {
    // this.socket.emit(
    //   SocketEvents.PT_TASK_END_DATE_CHANGE.toString(), JSON.stringify({
    //     task_id: task.id,
    //     end_date: date || null,
    //     parent_task: task.parent_task_id,
    //   }));
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
