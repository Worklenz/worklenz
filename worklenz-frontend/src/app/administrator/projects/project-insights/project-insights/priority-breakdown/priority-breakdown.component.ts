import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {ProjectInsightsService} from "@api/project-insights.service";
import {ActivatedRoute} from "@angular/router";
import {log_error} from "@shared/utils";
import {BaseChartDirective} from "ng2-charts";
import {ChartConfiguration} from "chart.js";

@Component({
  selector: 'worklenz-priority-breakdown',
  templateUrl: './priority-breakdown.component.html',
  styleUrls: ['./priority-breakdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PriorityBreakdownComponent implements OnChanges {
  @ViewChild(BaseChartDirective) barChart: BaseChartDirective | undefined;
  @ViewChild('statusOverviewChart') statusOverviewChart!: ElementRef;
  @Input() archived = false;

  private readonly includeArchivedTasks = "include-archived-tasks";

  loading = false;
  projectId = '';

  priorityStats: any[] = [];
  priorityColors: string[] = []
  options: any = {};

  barChartPlugins = [];

  barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{data: [], label: 'Tasks', backgroundColor: this.priorityColors}]
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: false,
    plugins: {
      datalabels: {
        display: false
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Task Count',
          align: "end",
          font: {
            family: 'Helvetica'
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Priority',
          align: "end",
          font: {
            family: 'Helvetica'
          }
        }
      }
    }
  };

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
      return 580;
    } else if (windowWidth < 1400 && windowWidth > 1200) {
      return 460;
    }
    return 350;
  }

  ngOnChanges(changes: SimpleChanges) {
    this.getPriorityBreakdown();
  }

  get archivedTasksChoice() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  async getPriorityBreakdown() {
    try {
      this.loading = true;
      this.barChartData.datasets[0].data = [];
      this.barChartData.labels = [];
      const res = await this.api.getPriorityOverview(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.priorityStats = res.body;
        this.loadChart(this.priorityStats);
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
    this.barChartData.datasets[0].data = [];
    this.barChartData.labels = [];

    for (const item of seriesData) {
      this.barChartData.labels?.push(item.name);
      this.barChartData.datasets[0].data.push(item.data[0] || 0);
      this.priorityColors.push(item.color);
    }
    this.barChart?.update();
    this.cdr.markForCheck();
  }

}
