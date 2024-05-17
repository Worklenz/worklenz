import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ActivityLogsService} from "@api/activity-logs.service";
import {log_error} from "@shared/utils";
import {IActivityLogAttributeTypes, IActivityLogsResponse} from "@interfaces/api-models/activity-logs-get-response";
import {AvatarNamesMap} from "@shared/constants";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";

@Component({
  selector: 'worklenz-task-view-activity-log',
  templateUrl: './task-view-activity-log.component.html',
  styleUrls: ['./task-view-activity-log.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewActivityLogComponent implements OnInit, OnDestroy {
  @Input() taskId: string | null = null;

  loading = false;
  logs: IActivityLogsResponse = {};
  readonly activityLogTypes = IActivityLogAttributeTypes;

  constructor(
    private readonly api: ActivityLogsService,
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
  ) {
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), () => {
      void this.getActivityLogs();
    });
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), () => {
      void this.getActivityLogs();
    });
  }

  ngOnInit() {
    void this.getActivityLogs();
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), () => {
      void this.getActivityLogs();
    });
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), () => {
      void this.getActivityLogs();
    });
  }

  async getActivityLogs() {
    if (!this.taskId) return;
    try {
      this.loading = true;
      const res = await this.api.getActivityLogs(this.taskId);
      if (res.done) {
        this.logs = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

}
