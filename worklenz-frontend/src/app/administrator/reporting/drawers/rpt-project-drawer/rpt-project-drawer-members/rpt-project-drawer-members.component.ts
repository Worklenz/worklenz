import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';
import {IRPTOverviewProjectMember} from "../../../interfaces";
import {ReportingApiService} from "../../../reporting-api.service";

@Component({
  selector: 'worklenz-rpt-project-drawer-members',
  templateUrl: './rpt-project-drawer-members.component.html',
  styleUrls: ['./rpt-project-drawer-members.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptProjectDrawerMembersComponent implements OnInit {
  @Input({required: true}) projectId: string | null = null;

  @Output() selectMember = new EventEmitter<IRPTOverviewProjectMember>();

  loading = false;
  members: IRPTOverviewProjectMember[] = [];

  searchText!: string;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService
  ) {
  }

  ngOnInit() {
    void this.get();
  }

  trackBy(index: number, data: IRPTOverviewProjectMember) {
    return data.id;
  }

  private async get() {
    if (!this.projectId) return;
    try {
      this.loading = true;
      const res = await this.api.getProjectMembers(this.projectId);
      if (res.done) {
        this.members = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  openMember(member: IRPTOverviewProjectMember) {
    if (member) {
      this.selectMember.emit(member);
    }
  }
}

