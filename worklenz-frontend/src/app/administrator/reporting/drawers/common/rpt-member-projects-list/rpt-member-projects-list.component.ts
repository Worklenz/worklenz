import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';
import {ReportingApiService} from "../../../reporting-api.service";
import {IRPTMemberProject, IRPTOverviewProject, IRPTOverviewProjectExt} from "../../../interfaces";
import {ReportingDrawersService} from "../../reporting-drawers.service";
import {ReportingService} from "../../../reporting.service";

@Component({
  selector: 'worklenz-rpt-member-projects-list',
  templateUrl: './rpt-member-projects-list.component.html',
  styleUrls: ['./rpt-member-projects-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class RptMemberProjectsListComponent implements OnInit {
  @Input({required: true}) teamMemberId = '';
  @Input() teamId: string | null = null;

  @Output() openTasks = new EventEmitter<IRPTOverviewProject>();

  searchText: string | null = null;

  loading = false;
  model: IRPTMemberProject[] = [];

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly drawer: ReportingDrawersService,
    private readonly service: ReportingService,
  ) {
  }

  async ngOnInit() {
    await this.get(true);
  }

  async search() {
    await this.get(false);
  }

  private async get(loading = true) {
    if (!this.teamMemberId) return;
    try {
      this.loading = loading;
      const res = await this.api.getMemberProjects({
        teamMemberId: this.teamMemberId,
        teamId: this.teamId,
        search: this.searchText,
        archived: this.service.getIncludeToggle()
      });
      if (res.done) {
        this.model = res.body;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  openProject(project: IRPTMemberProject) {
    const body: IRPTOverviewProjectExt = {
      id: project.id,
      name: project.name,
      client: '',
      status: {name: '', color_code: '', icon: ''},
      team_member_id: project.team_member_id
    }
    this.openTasks.emit(body);
  }

}
