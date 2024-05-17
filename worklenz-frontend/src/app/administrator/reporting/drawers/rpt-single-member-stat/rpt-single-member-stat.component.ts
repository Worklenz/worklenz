import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {IMemberTaskStatGroup} from "../../interfaces";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ReportingDrawersService} from "../reporting-drawers.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {log_error} from "@shared/utils";
import {ReportingApiService} from "../../reporting-api.service";
import {ReportingService} from "../../reporting.service";
import {AuthService} from "@services/auth.service";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {merge} from "rxjs";
import {TaskViewService} from "@admin/components/task-view/task-view.service";

@Component({
  selector: 'worklenz-rpt-single-member-stat',
  templateUrl: './rpt-single-member-stat.component.html',
  styleUrls: ['./rpt-single-member-stat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptSingleMemberStatComponent implements OnInit, OnDestroy {

  show = false;
  loading = false;

  titleText: string | null = null;
  searchText: string | null = null;

  groups: IMemberTaskStatGroup[] | null = null;
  teamMemberId: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly reportingService: ReportingService,
    private readonly drawer: ReportingDrawersService,
    private readonly api: ReportingApiService,
    private readonly socket: Socket,
    private readonly taskView: TaskViewService,
  ) {
    this.drawer.onOpenSingleMemberTaskStat
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        if (!value) return;
        this.teamMemberId = value.team_member_id;
        this.show = true;
        this.cdr.markForCheck();
        setTimeout(async () => {
          await this.get(value);
        }, 50);
      });

    merge(
      this.taskView.onRefresh
    ).pipe(takeUntilDestroyed())
      .subscribe(async () => {
        await this.refresh();
      });

  }

  ngOnInit() {
    this.listenSockets();
  }

  listenSockets() {
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_PHASE_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_TIMER_STOP.toString(), this.refresh);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_PHASE_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_TIMER_STOP.toString(), this.refresh);
  }

  async get(data: { team_member_id: string }) {
    if (!data) return;
    try {
      this.loading = true;
      const body = {
        team_member_id: data.team_member_id,
        team_id: this.auth.getCurrentSession()?.team_id,
        duration: this.reportingService.getDrawerDuration()?.key,
        date_range: this.reportingService.getDrawerDateRange(),
        archived: this.reportingService.getIncludeToggle()
      }
      const res = await this.api.getMemberTasksStats(body);
      if (res.done) {
        this.groups = res.body.groups;
        this.titleText = res.body.team_member_name;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
    this.cdr.markForCheck();
  }

  trackByGroup(index: number, data: IMemberTaskStatGroup) {
    return data.name;
  }

  trackByTask(index: number, data: IProjectTask) {
    return data.id;
  }

  refresh = async () => {
    if (!this.teamMemberId) return;
    await this.get({team_member_id: this.teamMemberId})
  }

  reset() {
    this.teamMemberId = null;
    this.show = false;
    this.loading = false;
    this.titleText = null;
    this.groups = null;
    this.cdr.markForCheck();
  }

  close() {
    this.reset();
  }

  openTask(data: IProjectTask) {
    if (data.id && data.project_id) {
      this.drawer.openTask({
        taskId: data.id,
        projectId: data.project_id
      });
    }
  }
}
