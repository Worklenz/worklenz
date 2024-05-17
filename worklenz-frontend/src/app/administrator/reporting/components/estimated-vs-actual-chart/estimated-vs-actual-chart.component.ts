import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {BaseChartDirective} from "ng2-charts";
import {ChartConfiguration} from "chart.js";

@Component({
  selector: 'worklenz-estimated-vs-actual-chart-common',
  templateUrl: './estimated-vs-actual-chart.component.html',
  styleUrls: ['./estimated-vs-actual-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstimatedVsActualChartComponent implements OnChanges, AfterViewInit {
  @ViewChild(BaseChartDirective) barChart: BaseChartDirective | undefined;

  @Input({required: true}) actualTime: number | null = 0;
  @Input({required: true}) estimatedTime: number | null = 0;
  @Input() estimatedTimeString: string | null = null;
  @Input() actualTimeString: string | null = null;

  visible = false;

  public barChartLegend = false;
  public barChartPlugins = [];

  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [''],
    datasets: []
  };

  public barChartOptions: ChartConfiguration<'bar'>['options'] = {
    plugins: {
      datalabels: {
        display: false
      }
    },
    responsive: false,
    maintainAspectRatio: false,
    indexAxis: "y",
    scales: {
      x: {
        grid: {
          display: false,
        },
        display: false
      },
      y: {
        grid: {
          display: false
        },
        display: false
      },
    }
  };

  constructor(
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    setTimeout(() => {
      this.barChart?.update();
      this.cdr.markForCheck();
    }, 1000)
  }

  ngAfterViewInit() {
    this.visible = true;
    setTimeout(() => {
      this.barChart?.data?.datasets.push(
        {data: [this.estimatedTime], label: '', backgroundColor: ['#A5AAD9']},
        {data: [this.actualTime], label: '', backgroundColor: ['#c191cc']}
      );
      this.barChart?.update();
      this.cdr.markForCheck();
    }, 1000)
  }
}
