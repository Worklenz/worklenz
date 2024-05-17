import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {IRPTMember, IRPTOverviewProject, IRPTTeam} from "../../interfaces";
import {ReportingDrawersService} from "../reporting-drawers.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ReportingService} from "../../reporting.service";
import {log_error} from "@shared/utils";
import {ReportingExportApiService} from "@api/reporting-export-api.service";

@Component({
  selector: 'worklenz-rpt-team-drawer',
  templateUrl: './rpt-team-drawer.component.html',
  styleUrls: ['./rpt-team-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptTeamDrawerComponent {
  projectsLength = 0;
  membersLength = 0;

  team: IRPTTeam | null = null;

  exporting = false;

  get show() {
    return !!this.team;
  }

  constructor(
    private readonly drawer: ReportingDrawersService,
    private readonly service: ReportingService,
    private readonly cdr: ChangeDetectorRef,
    private readonly exportApi: ReportingExportApiService
  ) {
    this.drawer.onOpenTeam
      .pipe(takeUntilDestroyed())
      .subscribe((team) => {
        this.open(team);
      });
  }

  close() {
    this.team = null;
  }

  openProject(project: IRPTOverviewProject) {
    this.team = this.service.getCurrentTeam();
    this.drawer.openProject(project);
  }

  openMember(member: IRPTMember, project: IRPTOverviewProject | null) {
    this.drawer.openMember(member, project);
  }

  private open(team: IRPTTeam | null) {
    this.team = team;
    this.cdr.markForCheck();
  }

  // excel exports
  async exportProjects() {
    if(!this.team) return;
    const team = this.team;
    try {
      this.exporting = true;
      await this.exportApi.exportOverviewProjectsByTeam(team.id, team.name);
      this.exporting = false;
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  async exportMembers() {
    if(!this.team) return;
    const team = this.team;
    try {
      this.exporting = true;
      this.exportApi.exportOverviewMembersByTeam(team.id, team.name);
      this.exporting = false;
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

}
