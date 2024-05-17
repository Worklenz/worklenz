import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {ReportingDrawersService} from "../reporting-drawers.service";
import {ReportingService} from "../../reporting.service";
import {ReportingApiService} from "../../reporting-api.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {log_error} from "@shared/utils";
import {IMemberTaskStatGroup, IRPTProject} from "../../interfaces";
import {AvatarNamesMap} from "@shared/constants";
import {color} from "chart.js/helpers";

@Component({
  selector: 'worklenz-rpt-single-member-projects-drawer',
  templateUrl: './rpt-single-member-projects-drawer.component.html',
  styleUrls: ['./rpt-single-member-projects-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptSingleMemberProjectsDrawerComponent {

  show = false;
  loading = false;

  titleText: string | null = null;

  projects: IRPTProject[] = [];

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly drawer: ReportingDrawersService,
    private readonly api: ReportingApiService,
    private readonly reportingService: ReportingService,
  ) {
    this.drawer.onOpenSingleMemberProjects.pipe(takeUntilDestroyed()).subscribe(value => {
      if (!value) return;
        this.show = true;
        this.cdr.markForCheck();
        setTimeout(async() => {
          await this.get(value);
        }, 50);
    })
  }

  private async get(data: {team_member_id: string}) {
    if(!data.team_member_id) return;
    try {
      this.loading = true;
      const body = {
        team_member_id: data.team_member_id,
        archived: this.reportingService.getIncludeToggle()
      }
      const res  = await this.api.getSingleMemberProjects(body);
      if(res.done) {
        this.projects = res.body.projects;
        this.titleText = res.body.team_member_name;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  trackByProject(index: number, data: IRPTProject) {
    return data.id;
  }

  reset() {
    this.show = false;
    this.projects = [];
    this.loading = false;
    this.titleText= null;
    this.cdr.markForCheck();
  }

  close() {
    this.reset();
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

}
