import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone, OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {IRPTOverviewMemberInfo} from "../../../interfaces";
import {ReportingApiService} from "../../../reporting-api.service";
import {ChartConfiguration} from "chart.js";
import {BaseChartDirective} from "ng2-charts";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {ReportingService} from "../../../reporting.service";

@Component({
  selector: 'worklenz-rpt-member-drawer-overview',
  templateUrl: './rpt-member-drawer-overview.component.html',
  styleUrls: ['./rpt-member-drawer-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptMemberDrawerOverviewComponent implements OnInit, OnDestroy {
  @Input({required: true}) memberId: string | null = null;

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
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ReportingService,
    private readonly api: ReportingApiService,
    protected readonly ngZone: NgZone,
    private readonly socket: Socket,
  ) {

  }

  ngOnInit() {
    void this.get();
    this.listenSockets();
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.QUICK_TASK.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.refresh);
  }

  listenSockets() {
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.QUICK_TASK.toString(), this.refresh);
    this.socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.refresh);
  }

  public async get() {
    if (!this.memberId) return;
    try {
      this.loading = true;
      this.clearCharts();
      const res = await this.api.getTeamMemberInfo(
        {
          teamMemberId: this.memberId,
          duration: 'LAST_WEEK',
          date_range: [],
          archived: this.service.getIncludeToggle()
        }
      );
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

      if (this.projectsChartData.datasets[0].data.every(value => value === 0))
        this.isProjectsChartEmpty = true;
      this.cdr.markForCheck();
    }
    if (data.by_priority) {
      for (const item of data.by_priority.chart) {
        this.prioritiesChartData.labels?.push(item.name);
        this.prioritiesChartData.datasets[0].data.push(item.y || 0);
        this.priorityColors.push(item.color as string);
      }
      this.priorityTaskChart?.update();

      if (this.prioritiesChartData.datasets[0].data.every(value => value === 0))
        this.isPriorityChartEmpty = true;
      this.cdr.markForCheck();
    }
    if (data.by_status) {
      for (const item of data.by_status.chart) {
        this.statusChartData.labels?.push(item.name);
        this.statusChartData.datasets[0].data.push(item.y || 0);
        this.statusColors.push(item.color as string);
      }
      this.statusTaskChart?.update();

      if (this.statusChartData.datasets[0].data.every(value => value === 0))
        this.isStatusChartEmpty = true;
      this.cdr.markForCheck();
    }
    this.cdr.markForCheck();
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
