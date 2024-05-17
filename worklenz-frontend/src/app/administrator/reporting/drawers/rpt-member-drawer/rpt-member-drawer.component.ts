import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {IRPTDuration, IRPTMember, IRPTMemberDrawerData, IRPTOverviewProject, IRPTTeam} from "../../interfaces";
import {ReportingDrawersService} from "../reporting-drawers.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ReportingService} from "../../reporting.service";
import {log_error} from "@shared/utils";
import {ReportingExportApiService} from "@api/reporting-export-api.service";
import {ALL_TIME, LAST_MONTH, LAST_QUARTER, LAST_WEEK, YESTERDAY} from "@shared/constants";
import moment from "moment";

@Component({
  selector: 'worklenz-rpt-member-drawer',
  templateUrl: './rpt-member-drawer.component.html',
  styleUrls: ['./rpt-member-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptMemberDrawerComponent {
  member: IRPTMember | null = null;
  team: IRPTTeam | null = null;
  project: IRPTOverviewProject | null = null;

  show = false;
  exporting = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ReportingService,
    private readonly drawer: ReportingDrawersService,
    private readonly exportApiService: ReportingExportApiService,
  ) {
    this.drawer.onOpenMember
      .pipe(takeUntilDestroyed())
      .subscribe(data => {
        this.open(data);
      });
  }

  close() {
    this.show = false;
    this.member = null;
    this.team = null;
    this.project = null;
  }

  onSelectProject(project: IRPTOverviewProject) {
    if (this.member)
      this.drawer.openTasks(project, this.member);
  }

  private open(data: IRPTMemberDrawerData) {
    this.team = this.service.getCurrentTeam();
    this.member = data.member;
    this.project = data.project;
    this.show = true
    this.cdr.markForCheck();
  }

  async exportProjects() {
    if (!this.member || !this.team) return;
    try {
      await this.exportApiService.exportMemberProjects(this.member.id, this.team.id, this.member.name, this.team.name, this.service.getIncludeToggle());
    } catch (e) {
      log_error(e);
    }
  }

  async exportTasks() {
    if (!this.member) return;
    try {
      await this.exportApiService.exportMemberTasks(this.member.id, this.member.name, this.team?.name, {archived: this.service.getIncludeToggle(), only_single_member: true});
    } catch (e) {
      log_error(e);
    }
  }
}
