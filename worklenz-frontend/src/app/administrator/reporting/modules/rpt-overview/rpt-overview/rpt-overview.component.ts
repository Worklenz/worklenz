import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {AppService} from "@services/app.service";
import {IRPTTeam} from "../../../interfaces";
import {ReportingApiService} from "../../../reporting-api.service";
import {ReportingDrawersService} from "../../../drawers/reporting-drawers.service";
import {ReportingService} from "../../../reporting.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-rpt-overview',
  templateUrl: './rpt-overview.component.html',
  styleUrls: ['./rpt-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptOverviewComponent implements OnInit {
  loading = false;
  isDurationLabelSelected = true;
  teams: IRPTTeam[] = [];

  selectedTeam: IRPTTeam | null = null;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly app: AppService,
    private readonly drawer: ReportingDrawersService,
    private reportingApi: ReportingService,
  ) {
    this.app.setTitle("Reporting - Overview");

    this.reportingApi.onIncludeToggleChange
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
      const res = await this.api.getOverviewTeams(this.reportingApi.getIncludeToggle());
      if (res.done) {
        this.teams = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  openTeamInfo(team: IRPTTeam) {
    this.selectedTeam = team;
    this.drawer.openTeam(team);
  }

  trackBy(index: number, data: IRPTTeam) {
    return data.id;
  }

}
