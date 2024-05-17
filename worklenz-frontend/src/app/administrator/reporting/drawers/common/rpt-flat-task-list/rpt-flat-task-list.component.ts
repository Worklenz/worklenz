import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ReportingApiService} from "../../../reporting-api.service";
import {IRPTOverviewProject, IRPTReportingMemberTask} from "../../../interfaces";
import {ReportingService} from "../../../reporting.service";
import {ReportingDrawersService} from "../../reporting-drawers.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {SocketEvents} from "@shared/socket-events";
import {TaskTimerService} from "@admin/components/task-timer/task-timer.service";
import {Socket} from "ngx-socket-io";
import {merge} from "chart.js/helpers";
import moment from "moment";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-rpt-flat-task-list',
  templateUrl: './rpt-flat-task-list.component.html',
  styleUrls: ['./rpt-flat-task-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptFlatTaskListComponent implements OnInit, OnDestroy {
  @Input() projectId: string | null = null;
  @Input() teamMemberId!: string;
  @Input() disableProjectsFilter = false;
  @Input() isMultiple: boolean = false;
  @Input() onlySingleMember: boolean = false;
  @Input() isDurationLabelSelected = true;

  loading = false;
  loadingProjects = false;

  tasks: IRPTReportingMemberTask[] = [];
  projects: IRPTOverviewProject[] = [];

  searchText!: string;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly service: ReportingService,
    private readonly drawer: ReportingDrawersService,
    private readonly view: TaskViewService,
    private readonly timerService: TaskTimerService,
    private readonly socket: Socket,
    private readonly auth: AuthService,
  ) {
    this.view.onRefresh
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get(false);
      });

    this.timerService.onSubmitOrUpdate
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get(false);
      });

    this.service.onDrawerDateRangeChange.pipe(takeUntilDestroyed()).subscribe(async () => {
      await this.get(true);
    });

    this.service.onDrawerDurationChange.pipe(takeUntilDestroyed()).subscribe(async () => {
      await this.get(true);
    });

  }

  ngOnInit() {
    void this.get();
    void this.getProjects();
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_TIMER_STOP.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_PHASE_CHANGE.toString(), this.refreshList);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_TIMER_STOP.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_PHASE_CHANGE.toString(), this.refreshList);
  }

  private async setDatesForKeys() {
  if(this.service.getDrawerDuration()?.key) {
    const key = this.service.getDrawerDuration()?.key;
    const today = moment();

    switch (key) {
      case YESTERDAY:
        const yesterday = moment().subtract(1, "days");
        this.service.setDrawerDateRange([yesterday.toString(), yesterday.toString()]);
        break;
      case LAST_WEEK:
        const lastWeekStart = moment().subtract(1, "weeks");
        this.service.setDrawerDateRange([lastWeekStart.toString(), today.toString()]);
        break;
      case LAST_MONTH:
        const lastMonthStart = moment().subtract(1, "months");
        this.service.setDrawerDateRange([lastMonthStart.toString(), today.toString()]);
        break;
      case LAST_QUARTER:
        const lastQuaterStart = moment().subtract(3, "months");
        this.service.setDrawerDateRange([lastQuaterStart.toString(), today.toString()]);
        break;
      case PREV_WEEK:
        const prevWeekStart = moment().subtract(1, "weeks").startOf("week");
        const prevWeekEnd = moment().subtract(1, "weeks").endOf("week");
        this.service.setDrawerDateRange([prevWeekStart.toString(), prevWeekEnd.toString()]);
        break;
      case PREV_MONTH:
        const prevMonthStart = moment().subtract(1, "month").startOf("month");
        const prevMonthEnd = moment().subtract(1, "month").endOf("month");
        this.service.setDrawerDateRange([prevMonthStart.toString(), prevMonthEnd.toString()]);
        break;
    }
  }
}

  private async get(showLoading = true) {
    if (this.loading) return;
    this.loading = showLoading;
    if (this.isDurationLabelSelected && this.onlySingleMember) {
      await this.setDatesForKeys();
    }
    try {
      const additionalBody = {
        duration : this.onlySingleMember ? this.service.getDrawerDuration()?.key : this.service.getDuration()?.key,
        date_range : this.onlySingleMember ? this.service.getDrawerDateRange() : this.service.getDateRange(),
        only_single_member : this.onlySingleMember,
        archived: this.service.getIncludeToggle()
      };
      const res = await this.api.getTasksByMember(
        this.teamMemberId,
        this.projectId,
        false,
        null, additionalBody);
      if (res.done) {
        this.tasks = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  private async getProjects() {
    if (this.disableProjectsFilter || this.loadingProjects) return;
    this.loadingProjects = true;
    try {
      const teamId = this.service.getCurrentTeam()?.id as string;
      const res = await this.api.getOverviewProjectsByTeam(teamId, this.teamMemberId);
      if (res.done) {
        this.projects = res.body;
      }
      this.loadingProjects = false;
    } catch (e) {
      this.loadingProjects = false;
    }

    this.cdr.markForCheck();
  }

  trackBy(index: number, data: IRPTReportingMemberTask) {
    return data.id;
  }

  openTask(data: IRPTReportingMemberTask) {
    if (data.id && data.project_id)
      this.drawer.openTask({taskId: data.id, projectId: data.project_id});
  }

  onProjectChange(projectId: string) {
    this.projectId = projectId;
    void this.get();
  }

  refreshList = (response: any) => {
    this.get(false);
  }
}
