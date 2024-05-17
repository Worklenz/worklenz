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
import {Socket} from "ngx-socket-io";

@Component({
  selector: 'worklenz-task-start-date',
  templateUrl: './task-start-date.component.html',
  styleUrls: ['./task-start-date.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskStartDateComponent {
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
    start_date: string;
  }) => {
    if (response.id === this.task.id && this.task.start_date !== response.start_date) {
      this.task.start_date = response.start_date;
      this.cdr.markForCheck();
    }
  };

  toggleHighlightCls(active: boolean, element: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      if (active) {
        this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
      } else {
        this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
      }
    });
  }

  handleStartDateChange(date: string, task: IPTTask) {
    // this.socket.emit(
    //   SocketEvents.PT_TASK_START_DATE_CHANGE.toString(), JSON.stringify({
    //     task_id: task.id,
    //     start_date: date || null,
    //     parent_task: task.parent_task_id,
    //   }));
  }

}
