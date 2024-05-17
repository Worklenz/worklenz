import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {IRPTMember, IRPTOverviewProject, IRPTOverviewProjectMember, IRPTTeam} from "../../interfaces";
import {ReportingDrawersService} from "../reporting-drawers.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ReportingService} from "../../reporting.service";
import {log_error} from "@shared/utils";
import {ReportingExportApiService} from "@api/reporting-export-api.service";

@Component({
  selector: 'worklenz-rpt-project-drawer',
  templateUrl: './rpt-project-drawer.component.html',
  styleUrls: ['./rpt-project-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptProjectDrawerComponent {
  team: IRPTTeam | null = null;
  project: IRPTOverviewProject | null = null;

  exporting = false

  get show() {
    return !!this.project;
  }

  constructor(
    private readonly drawer: ReportingDrawersService,
    private readonly service: ReportingService,
    private readonly cdr: ChangeDetectorRef,
    private readonly exportApi: ReportingExportApiService
  ) {
    this.drawer.onOpenProject
      .pipe(takeUntilDestroyed())
      .subscribe(project => {
        this.open(project);
      });
  }

  close() {
    this.project = null;
  }

  onSelectMember(member: IRPTOverviewProjectMember) {
    if (this.project) {
      const mem = {
        id: member.team_member_id,
        name: member.name
      };
      this.drawer.openTasks(this.project, mem as IRPTMember);
    }
  }

  private open(project: IRPTOverviewProject | null) {
    this.team = this.service.getCurrentTeam();
    this.project = project;
    this.cdr.markForCheck();
  }

  async exportMembers() {
    if (!this.project?.id) return;
    try {
      await this.exportApi.exportProjectMembers(this.project.id, this.project.name, this.team?.name);
    } catch (e) {
      log_error(e);
    }
  }

  async exportTasks() {
    if (!this.project?.id) return;
    try {
      await this.exportApi.exportProjectTasks(this.project.id, this.project.name, this.team?.name);
    } catch (e) {
      log_error(e);
    }
  }
}
