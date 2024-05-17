import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input, NgZone, OnDestroy, OnInit,
  ViewChild
} from '@angular/core';
import {IPTTask} from "../../../interfaces";
import {Socket} from "ngx-socket-io";
import {PtTaskListService} from "../../../services/pt-task-list.service";
import {UtilsService} from "@services/utils.service";
import {SocketEvents} from "@shared/socket-events";

@Component({
  selector: 'worklenz-task-estimation',
  templateUrl: './task-estimation.component.html',
  styleUrls: ['./task-estimation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskEstimationComponent implements OnInit, OnDestroy {
  @ViewChild('labelsSearchInput', {static: false}) labelsSearchInput!: ElementRef<HTMLInputElement>;
  @Input() task: IPTTask = {};
  @HostBinding("class") cls = "flex-row task-estimation p-0";

  show = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    public readonly service: PtTaskListService,
    public readonly utils: UtilsService,
    private readonly ngZone: NgZone,
  ) {
  }

  ngOnInit(): void {
    this.socket.on(SocketEvents.PT_TASK_TIME_ESTIMATION_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy(): void {
    this.socket.removeListener(SocketEvents.PT_TASK_TIME_ESTIMATION_CHANGE.toString(), this.handleResponse);
  }


  handleLabelsVisibleChange(visible: boolean, tr: HTMLDivElement) {
    this.show = visible;
    visible ? tr.classList.add(this.service.HIGHLIGHT_COL_CLS) : tr.classList.remove(this.service.HIGHLIGHT_COL_CLS);
  }

  submit() {
    if (!this.task?.id) return;
    this.socket.emit(SocketEvents.PT_TASK_TIME_ESTIMATION_CHANGE.toString(), JSON.stringify({
      task_id: this.task.id,
      total_hours: this.task.total_hours || 0,
      total_minutes: this.task.total_minutes || 0,
      parent_task: this.task.parent_task_id,
    }));
  }

  private handleResponse = (response: { id: string; total_time_string: string; }) => {
    if (this.task.id === response?.id) {
      this.task.total_time_string = response.total_time_string;
      this.closeDropdown();
      this.cdr.markForCheck();
    }
  };

  closeDropdown() {
    this.ngZone.runOutsideAngular(() => {
      document.body.click();
    });
  }

}
