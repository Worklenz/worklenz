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
import {ReportingApiService} from "../../../reporting-api.service";
import {IRPTOverviewTeamInfo} from 'app/administrator/reporting/interfaces';
import {BaseChartDirective} from "ng2-charts";
import {ChartConfiguration} from "chart.js";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ReportingService} from "../../../reporting.service";

@Component({
  selector: 'worklenz-rpt-team-overview',
  templateUrl: './rpt-team-overview.component.html',
  styleUrls: ['./rpt-team-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class RptTeamOverviewComponent implements OnInit, OnDestroy {
  @Input({required: true}) teamId!: string;

  @ViewChild(BaseChartDirective) statusChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) categoryChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) healthChart: BaseChartDirective | undefined;

  model: IRPTOverviewTeamInfo = {};

  loading = false;
  isStatusChartEmpty = false;
  isCategoryChartEmpty = false;
  isHealthChartEmpty = false;

  statusColors: string[] = [];
  categoryColors: string[] = [];
  healthColors: string[] = [];

  statusChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Projects',
      data: [],
      backgroundColor: this.statusColors,
      hoverOffset: 2
    }]
  };

  categoryChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Projects',
      data: [],
      backgroundColor: this.categoryColors,
      hoverOffset: 2
    }]
  };

  healthChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Projects',
      data: [],
      backgroundColor: this.healthColors,
      hoverOffset: 2,
    }]
  }

  chartOptions: ChartConfiguration<'doughnut'>['options'] = {
    plugins: {
      datalabels: {
        display: false
      }
    },
    responsive: false
  }

  constructor(
    protected readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly socket: Socket,
    private readonly service: ReportingService
  ) {

  }

  ngOnInit() {
    void this.get();
    this.listenSockets();
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.PROJECT_STATUS_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), this.refresh);
  }

  listenSockets() {
    this.socket.on(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.PROJECT_STATUS_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), this.refresh);
  }

  public async get() {
    if (!this.teamId) return;
    try {
      this.loading = true;
      this.clearCharts();
      const res = await this.api.getTeamInfo(this.teamId, this.service.getIncludeToggle());
      if (res.done) {
        this.model = res.body;
        this.drawCharts(res.body);
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private drawCharts(data: IRPTOverviewTeamInfo) {
    if (data.by_status) {
      for (const item of data.by_status.chart) {
        this.statusChartData.labels?.push(item.name);
        this.statusChartData.datasets[0].data.push(item.y || 0);
        this.statusColors.push(item.color as string);
      }
      this.statusChart?.update();
      if (this.statusChartData.datasets[0].data.every(value => value === 0))
        this.isStatusChartEmpty = true;
    }

    if (data.by_category) {
      for (const item of data.by_category.chart) {
        this.categoryChartData.labels?.push(item.name);
        this.categoryChartData.datasets[0].data.push(item.y || 0);
        this.categoryColors.push(item.color as string);
      }
      this.categoryChart?.update();
      if (this.categoryChartData.datasets[0].data.every(value => value === 0))
        this.isCategoryChartEmpty = true;
    }

    if (data.by_health) {
      for (const item of data.by_health.chart) {
        this.healthChartData.labels?.push(item.name);
        this.healthChartData.datasets[0].data.push(item.y || 0);
        this.healthColors.push(item.color as string);
      }
      this.healthChart?.update();
      if (this.healthChartData.datasets[0].data.every(value => value === 0))
        this.isHealthChartEmpty = true;
    }
    this.cdr.markForCheck();
  }

  clearCharts() {
    this.statusChartData.datasets[0].data = [];
    this.categoryChartData.datasets[0].data = [];
    this.healthChartData.datasets[0].data = [];

    this.statusChartData.labels = [];
    this.categoryChartData.labels = [];
    this.healthChartData.labels = [];

    this.cdr.markForCheck();
  }

  refresh = (response: any) => {
    this.get();
    this.cdr.markForCheck();
  }

}
