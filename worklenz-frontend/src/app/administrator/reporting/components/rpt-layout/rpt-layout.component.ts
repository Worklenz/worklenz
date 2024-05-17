import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2
} from '@angular/core';
import {ReportingApiService} from "../../reporting-api.service";
import {ReportingService} from "../../reporting.service";
import {Chart} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

@Component({
  selector: 'worklenz-rpt-layout',
  templateUrl: './rpt-layout.component.html',
  styleUrls: ['./rpt-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptLayoutComponent implements OnInit, OnDestroy {
  collapsed = false;
  loading = false;
  opened = false;

  get organization() {
    return this.service.currentOrganization;
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ReportingService,
    private readonly api: ReportingApiService,
    private readonly renderer: Renderer2,
    private readonly ngZone: NgZone
  ) {
    Chart.register(ChartDataLabels);
  }

  ngOnInit() {
    void this.getInfo();
    this.ngZone.runOutsideAngular(() => {
      const currentUrl = window.location.href;
      if (currentUrl.includes('/time-sheet-')) {
        this.opened = true;
      } else {
        this.opened = false;
      }
      this.renderer.addClass(document.body, "reporting");
    });
  }

  ngOnDestroy() {
    this.ngZone.runOutsideAngular(() => {
      this.renderer.removeClass(document.body, "reporting");
    });
  }

  async getInfo() {
    try {
      this.loading = true;
      const res = await this.api.getInfo();
      if (res.done) {
        this.service.currentOrganization = res.body.organization_name;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }
}
