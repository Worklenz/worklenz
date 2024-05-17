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
import {ChartConfiguration} from 'chart.js';
import {BaseChartDirective} from "ng2-charts";

@Component({
  selector: 'worklenz-rpt-projects-estimated-vs-actual',
  templateUrl: './rpt-projects-estimated-vs-actual.component.html',
  styleUrls: ['./rpt-projects-estimated-vs-actual.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptProjectsEstimatedVsActualComponent implements OnChanges, AfterViewInit {
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
    datasets: [],
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
  ) {
  }

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
        {data: [this.estimatedTime], label: '', backgroundColor: ['#A5AAD9'], barThickness: 30},
        {data: [this.actualTime], label: '', backgroundColor: ['#c191cc'], barThickness: 30}
      );
      this.barChart?.update();
      this.cdr.markForCheck();
    }, 1000)
  }
}
