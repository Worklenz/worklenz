import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, ViewChild} from '@angular/core';
import {log_error} from "@shared/utils";
import {ProjectWorkloadApiService} from "@api/project-workload-api.service";
import {IWLMember, IWLMemberOverview, IWLMemberOverviewResponse} from "@interfaces/workload";
import {BaseChartDirective} from "ng2-charts";
import {ChartConfiguration} from "chart.js";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {WlTasksService} from "../../../services/wl-tasks.service";
import {of} from "rxjs";

@Component({
  selector: 'worklenz-overview-tab',
  templateUrl: './overview-tab.component.html',
  styleUrls: ['./overview-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewTabComponent {
  @Input({required: true}) teamMember: IWLMember | null = null;
  @Input({required: true}) projectId: string | null = null;

  @ViewChild(BaseChartDirective) statusChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) priorityChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) phaseChart: BaseChartDirective | undefined;
  @ViewChild(BaseChartDirective) datesChart: BaseChartDirective | undefined;

  memberTasksStatusOverview: IWLMemberOverview[] = [];
  memberTasksPriorityOverview: IWLMemberOverview[] = [];
  memberTasksPhaseOverview: IWLMemberOverview[] = [];
  memberTasksDatesOverview: IWLMemberOverview[] = [];

  loading = false;
  isStatusChartEmpty = false;
  isPriorityChartEmpty = false;
  isPhaseChartEmpty = false;
  isDatesChartEmpty = false;

  statusColors: string[] = [];
  priorityColors: string[] = [];
  phaseColors: string[] = [];
  datesColors: string[] = [];

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

  phaseChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Tasks',
      data: [],
      backgroundColor: this.phaseColors,
      hoverOffset: 2
    }]
  };

  datesChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Tasks',
      data: [],
      backgroundColor: this.datesColors,
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

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ProjectWorkloadApiService,
    public readonly service: WlTasksService,
  ) {
    this.service.updateOverviewCharts
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.init();
      })
  }

  init() {
    void this.getMemberOverviewData();
  }

  private async getMemberOverviewData() {
    if (!this.projectId || !this.teamMember) return;
    try {
      this.loading = true;
      this.clearCharts();
      const res = await this.api.getMemberOverview(this.projectId, this.teamMember.team_member_id);
      if (res.done) {
        this.memberTasksStatusOverview = res.body.by_status;
        this.memberTasksPriorityOverview = res.body.by_priority;
        this.memberTasksPhaseOverview = res.body.by_phase;
        this.memberTasksDatesOverview = res.body.by_dates;
        this.drawCharts(res.body);
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      log_error(e)
      this.cdr.markForCheck();
    }
  }

  private drawCharts(data: IWLMemberOverviewResponse) {
    if (data.by_status) {
      for (const item of data.by_status) {
        this.statusChartData.labels?.push(item.label);
        this.statusChartData.datasets[0].data.push(item.tasks_count || 0);
        this.statusColors.push(item.color_code as string);
      }
      this.statusChart?.update();
      if (this.statusChartData.datasets[0].data.every(value => value === 0))
        this.isStatusChartEmpty = true;
    }

    if (data.by_priority) {
      for (const item of data.by_priority) {
        this.priorityChartData.labels?.push(item.label);
        this.priorityChartData.datasets[0].data.push(item.tasks_count || 0);
        this.priorityColors.push(item.color_code as string);
      }
      this.priorityChart?.update();
      if (this.priorityChartData.datasets[0].data.every(value => value === 0))
        this.isPriorityChartEmpty = true;
    }

    if (data.by_phase) {
      for (const item of data.by_phase) {
        this.phaseChartData.labels?.push(item.label);
        this.phaseChartData.datasets[0].data.push(item.tasks_count || 0);
        this.phaseColors.push(item.color_code as string);
      }
      this.phaseChart?.update();
      if (this.phaseChartData.datasets[0].data.every(value => value === 0))
        this.isPhaseChartEmpty = true;
    }

    if (data.by_dates) {
      for (const item of data.by_dates) {
        this.datesChartData.labels?.push(item.label);
        this.datesChartData.datasets[0].data.push(item.tasks_count || 0);
        this.datesColors.push(item.color_code as string);
      }
      this.datesChart?.update();
      if (this.datesChartData.datasets[0].data.every(value => value === 0))
        this.isDatesChartEmpty = true;
    }
    this.cdr.markForCheck();
  }

  clearCharts() {
    this.statusChartData.datasets[0].data = [];
    this.priorityChartData.datasets[0].data = [];
    this.phaseChartData.datasets[0].data = [];
    this.datesChartData.datasets[0].data = [];

    this.statusChartData.labels = [];
    this.priorityChartData.labels = [];
    this.phaseChartData.labels = [];
    this.datesChartData.labels = [];

    this.cdr.markForCheck();
  }

  protected readonly of = of;
}
