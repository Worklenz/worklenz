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
import {IRPTOverviewProjectInfo} from "../../../interfaces";
import {ReportingApiService} from "../../../reporting-api.service";
import {BaseChartDirective} from "ng2-charts";
import {ChartConfiguration} from "chart.js";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";

@Component({
  selector: 'worklenz-rpt-project-drawer-overview',
  templateUrl: './rpt-project-drawer-overview.component.html',
  styleUrls: ['./rpt-project-drawer-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptProjectDrawerOverviewComponent implements OnInit, OnDestroy {
  @Input({required: true}) projectId: string | null = null;

  // @ViewChild('statusTaskChart', {static: false}) statusTaskChart!: ElementRef;
  // @ViewChild('priorityTaskChart', {static: false}) priorityTaskChart!: ElementRef;
  // @ViewChild('dueDateTaskChart', {static: false}) dueDateTaskChart!: ElementRef;

  @ViewChild(BaseChartDirective) statusTaskChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) priorityTaskChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) duedateTasksChart: BaseChartDirective | undefined;

  isStatusChartEmpty = false;
  isPriorityChartEmpty = false;
  isDueDateChartEmpty = false;

  statusColors: string[] = [];
  priorityColors: string[] = [];
  duedateColors: string[] = [];

  statusChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Tasks',
      data: [],
      backgroundColor: this.statusColors,
      hoverOffset: 2
    }]
  };

  priorityChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Tasks',
      data: [],
      backgroundColor: this.priorityColors,
      hoverOffset: 2
    }]
  };

  duedateChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Tasks',
      data: [],
      backgroundColor: this.duedateColors,
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
  model: IRPTOverviewProjectInfo = {};

  constructor(
    private readonly cdr: ChangeDetectorRef,
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
  }

  listenSockets() {
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.QUICK_TASK.toString(), this.refresh);
  }

  public async get() {
    if (!this.projectId) return;
    try {
      this.loading = true;
      this.clearCharts();
      const res = await this.api.getProjectInfo(this.projectId);
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

  private drawCharts(data: IRPTOverviewProjectInfo) {
    if (data.by_status) {
      for (const item of data.by_status.chart) {
        this.statusChartData.labels?.push(item.name);
        this.statusChartData.datasets[0].data.push(item.y || 0);
        this.statusColors.push(item.color as string);
      }
      this.statusTaskChart?.update();
      if (this.statusChartData.datasets[0].data.every(value => value === 0))
        this.isStatusChartEmpty = true;
    }
    if (data.by_priority) {
      for (const item of data.by_priority.chart) {
        this.priorityChartData.labels?.push(item.name);
        this.priorityChartData.datasets[0].data.push(item.y || 0);
        this.priorityColors.push(item.color as string);
      }
      this.priorityTaskChart?.update();

      if (this.priorityChartData.datasets[0].data.every(value => value === 0))
        this.isPriorityChartEmpty = true;
    }
    if (data.by_due) {
      for (const item of data.by_due.chart) {
        this.duedateChartData.labels?.push(item.name);
        this.duedateChartData.datasets[0].data.push(item.y || 0);
        this.duedateColors.push(item.color as string);
      }
      this.duedateTasksChart?.update();

      if (this.duedateChartData.datasets[0].data.every(value => value === 0))
        this.isDueDateChartEmpty = true;
    }
    this.cdr.markForCheck();
  }

  openList(group: string) {
    if (!this.projectId) return;
    this.ngZone.runOutsideAngular(() => {
      const a = document.createElement("a");
      if (group === 'status') a.href = `/worklenz/projects/${this.projectId}?group=status`;
      if (group === 'priority') a.href = `/worklenz/projects/${this.projectId}?group=priority`;
      a.target = "_blank";
      a.click();
    });
  }

  clearCharts() {
    this.statusChartData.datasets[0].data = [];
    this.priorityChartData.datasets[0].data = [];
    this.duedateChartData.datasets[0].data = [];

    this.statusChartData.labels = [];
    this.priorityChartData.labels = [];
    this.duedateChartData.labels = [];

    this.cdr.markForCheck();
  }

  refresh = (response: any) => {
    this.get();
  }

}
