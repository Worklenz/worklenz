import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {ProjectInsightsService} from "@api/project-insights.service";
import {log_error} from "@shared/utils";
import {ActivatedRoute} from "@angular/router";
import {BaseChartDirective} from "ng2-charts";
import {ChartConfiguration} from "chart.js";

declare let require: any;

@Component({
  selector: 'worklenz-status-overview',
  templateUrl: './status-overview.component.html',
  styleUrls: ['./status-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusOverviewComponent implements OnChanges {
  @Input() archived = false;

  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;
  private readonly includeArchivedTasks = "include-archived-tasks";

  loading = false;
  isChartEmpty = false;

  projectId = '';
  statusCounts: any = [];
  options: any = {};
  statusColors: string[] = [];

  chartPlugins = [];

  chartData: ChartConfiguration<'doughnut'>['data'] = {
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
    responsive: false,
  }

  constructor(
    private api: ProjectInsightsService,
    private route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
  }

  get chartWidth() {
    const windowWidth = window.innerWidth;
    if (windowWidth > 1400) {
      return 350;
    } else if (windowWidth < 1400 && windowWidth > 1200) {
      return 275;
    }
    return 220;
  }

  ngOnChanges(changes: SimpleChanges) {
    this.getStatusCounts()
  }

  get archivedTasksChoice() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  async getStatusCounts() {
    try {
      this.loading = true;
      this.chartData.datasets[0].data = [];
      this.chartData.labels = [];
      const res = await this.api.getTaskStatusCounts(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.statusCounts = res.body;
        await this.loadChart(this.statusCounts);
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async loadChart(seriesData: any) {
    this.chartData.datasets[0].data = [];
    this.chartData.labels = [];

    for (const item of seriesData) {
      this.chartData.labels?.push(item.name);
      this.chartData.datasets[0].data.push(item.y || 0);
      this.statusColors.push(item.color);
    }
    this.chart?.update();

    if (this.chartData.datasets[0].data.every(value => value === 0))
      this.isChartEmpty = true;

    this.cdr.markForCheck();
  }

}
