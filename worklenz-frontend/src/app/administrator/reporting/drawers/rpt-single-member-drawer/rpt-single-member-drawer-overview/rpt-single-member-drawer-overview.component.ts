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
import {IRPTOverviewMemberInfo} from "../../../interfaces";
import {ReportingApiService} from "../../../reporting-api.service";
import {BaseChartDirective} from "ng2-charts";
import {ChartConfiguration} from "chart.js";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {LogHeaderService} from "./service/log-header.service";
import {ReportingService} from "../../../reporting.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import moment from "moment/moment";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";
import {ReportingDrawersService} from "../../reporting-drawers.service";
import {merge} from "rxjs";
import {TaskViewService} from "@admin/components/task-view/task-view.service";

@Component({
  selector: 'worklenz-rpt-single-member-drawer-overview',
  templateUrl: './rpt-single-member-drawer-overview.component.html',
  styleUrls: ['./rpt-single-member-drawer-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptSingleMemberDrawerOverviewComponent implements OnInit, OnDestroy {
  @Input({required: true}) teamMemberId: string | null = null;
  @Input() isDurationLabelSelected = true;
  @Input() isDurationLabelSelected_ = false;

  @ViewChild(BaseChartDirective) projectsTaskChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) priorityTaskChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) statusTaskChart: BaseChartDirective | undefined;

  isProjectsChartEmpty = false;
  isPriorityChartEmpty = false;
  isStatusChartEmpty = false;

  projectColors: string[] = [];
  priorityColors: string[] = [];
  statusColors: string[] = [];

  projectsChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Tasks',
      data: [],
      backgroundColor: this.projectColors,
      hoverOffset: 2
    }]
  };

  prioritiesChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Tasks',
      data: [],
      backgroundColor: this.priorityColors,
      hoverOffset: 2
    }]
  };

  statusChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Tasks',
      data: [],
      backgroundColor: this.statusColors,
      hoverOffset: 2
    }]
  };

  chartOptions: ChartConfiguration<'doughnut'>['options'] = {
    plugins: {
      datalabels: {
        display: false
      }
    },
    responsive: false
  }

  loading = false;
  model: IRPTOverviewMemberInfo = {};

  constructor(
    protected readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly socket: Socket,
    public readonly service: LogHeaderService,
    private readonly reportingService: ReportingService,
    private readonly drawerService: ReportingDrawersService,
    private readonly taskView: TaskViewService,
  ) {
    this.reportingService.onDrawerDurationChange.pipe(takeUntilDestroyed()).subscribe(async () => {
      await this.get();
    });
    this.reportingService.onDrawerDateRangeChange.pipe(takeUntilDestroyed()).subscribe(async () => {
      await this.get();
    });

    merge(
      this.taskView.onRefresh
    ).pipe(takeUntilDestroyed())
      .subscribe(async () => {
        await this.get();
      });

  }

  ngOnInit() {
    void this.get();
    this.listenSockets();
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_PHASE_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_TIMER_STOP.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.QUICK_TASK.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.refresh);
  }

  listenSockets() {
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_PHASE_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_TIMER_STOP.toString(), this.refresh);
    this.socket.on(SocketEvents.QUICK_TASK.toString(), this.refresh);
    this.socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.refresh);
  }

  private async setDatesForKeys() {
    if (this.reportingService.getDrawerDuration()?.key) {
      const key = this.reportingService.getDrawerDuration()?.key;
      const today = moment();

      switch (key) {
        case YESTERDAY:
          const yesterday = moment().subtract(1, "days");
          this.reportingService.setDrawerDateRange([yesterday.toString(), yesterday.toString()]);
          break;
        case LAST_WEEK:
          const lastWeekStart = moment().subtract(1, "weeks");
          this.reportingService.setDrawerDateRange([lastWeekStart.toString(), today.toString()]);
          break;
        case LAST_MONTH:
          const lastMonthStart = moment().subtract(1, "months");
          this.reportingService.setDrawerDateRange([lastMonthStart.toString(), today.toString()]);
          break;
        case LAST_QUARTER:
          const lastQuaterStart = moment().subtract(3, "months");
          this.reportingService.setDrawerDateRange([lastQuaterStart.toString(), today.toString()]);
          break;
        case PREV_WEEK:
          const prevWeekStart = moment().subtract(1, "weeks").startOf("week");
          const prevWeekEnd = moment().subtract(1, "weeks").endOf("week");
          this.reportingService.setDrawerDateRange([prevWeekStart.toString(), prevWeekEnd.toString()]);
          break;
        case PREV_MONTH:
          const prevMonthStart = moment().subtract(1, "month").startOf("month");
          const prevMonthEnd = moment().subtract(1, "month").endOf("month");
          this.reportingService.setDrawerDateRange([prevMonthStart.toString(), prevMonthEnd.toString()]);
          break;
      }
    }
  }

  public async get() {
    if (!this.teamMemberId) return;
    try {
      this.loading = true;
      this.clearCharts();

      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }
      const res = await this.api.getMemberInfo({
        teamMemberId: this.teamMemberId,
        duration: this.reportingService.getDrawerDuration()?.key,
        date_range: this.reportingService.getDrawerDateRange(),
        archived: this.reportingService.getIncludeToggle()
      });
      if (res.done) {
        this.model = res.body;
        this.drawCharts(res.body);
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  private drawCharts(data: IRPTOverviewMemberInfo) {
    if (data.by_project) {
      for (const item of data.by_project.chart) {
        this.projectsChartData.labels?.push(item.name);
        this.projectsChartData.datasets[0].data.push(item.y || 0);
        this.projectColors.push(item.color as string);
      }
      this.projectsTaskChart?.update();
      if (this.projectsChartData.datasets[0].data.length === 0) {
        this.isProjectsChartEmpty = true;
        this.cdr.markForCheck();
      } else {
        this.isProjectsChartEmpty = false;
      }
    }
    if (data.by_priority) {
      for (const item of data.by_priority.chart) {
        this.prioritiesChartData.labels?.push(item.name);
        this.prioritiesChartData.datasets[0].data.push(item.y || 0);
        this.priorityColors.push(item.color as string);
      }
      this.priorityTaskChart?.update();
      if (this.prioritiesChartData.datasets[0].data.every(value => value === 0)) {
        this.isPriorityChartEmpty = true;
      } else {
        this.isPriorityChartEmpty = false;
      }
    }
    if (data.by_status) {
      for (const item of data.by_status.chart) {
        this.statusChartData.labels?.push(item.name);
        this.statusChartData.datasets[0].data.push(item.y || 0);
        this.statusColors.push(item.color as string);
      }
      this.statusTaskChart?.update();
      if (this.statusChartData.datasets[0].data.every(value => value === 0)) {
        this.isStatusChartEmpty = true;
      } else {
        this.isStatusChartEmpty = false;
      }

    }
    this.cdr.markForCheck();
  }

  openTaskStatDrawer() {
    if (!this.teamMemberId) return;
    this.drawerService.openSingleMemberTaskStat({team_member_id: this.teamMemberId});
  }

  openProjects() {
    if (!this.teamMemberId) return;
    this.drawerService.openSingleMemberProjects({team_member_id: this.teamMemberId});
  }

  openTimeLogsTab() {
    if (!this.teamMemberId) return;
    this.drawerService.openTimeLogsTab();
  }

  clearCharts() {
    this.projectsChartData.datasets[0].data = [];
    this.prioritiesChartData.datasets[0].data = [];
    this.statusChartData.datasets[0].data = [];

    this.projectsChartData.labels = [];
    this.prioritiesChartData.labels = [];
    this.statusChartData.labels = [];

    this.cdr.markForCheck();
  }

  refresh = (response: any) => {
    this.get();
  }

}
