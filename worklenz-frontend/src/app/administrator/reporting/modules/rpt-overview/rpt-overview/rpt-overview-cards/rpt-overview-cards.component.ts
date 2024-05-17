import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ReportingApiService} from "../../../../reporting-api.service";
import {IRPTOverviewStatistics} from "../../../../interfaces";
import {ReportingService} from "../../../../reporting.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-rpt-overview-cards',
  templateUrl: './rpt-overview-cards.component.html',
  styleUrls: ['./rpt-overview-cards.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptOverviewCardsComponent implements OnInit {
  loading = false;

  model: IRPTOverviewStatistics = {};

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly service: ReportingService
  ) {
    this.service.onIncludeToggleChange
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get();
      });
  }

  ngOnInit() {
    void this.get();
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.getOverviewStatistics(this.service.getIncludeToggle());
      if (res.done) {
        this.model = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }
}
