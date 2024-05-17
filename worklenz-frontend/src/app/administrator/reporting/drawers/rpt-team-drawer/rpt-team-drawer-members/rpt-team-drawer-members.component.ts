import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import {IRPTMember} from "../../../interfaces";
import {ReportingApiService} from "../../../reporting-api.service";
import {ReportingService} from "../../../reporting.service";

@Component({
  selector: 'worklenz-rpt-team-drawer-members',
  templateUrl: './rpt-team-drawer-members.component.html',
  styleUrls: ['./rpt-team-drawer-members.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptTeamDrawerMembersComponent implements OnInit, OnDestroy {
  @Input({required: true}) teamId!: string;

  @Output() length = new EventEmitter<number>();
  @Output() selectMember = new EventEmitter<IRPTMember>();

  loading = false;
  members: IRPTMember[] = [];

  searchText!: string;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly service: ReportingService,
  ) {
  }

  ngOnInit() {
    void this.getMembers();
  }

  ngOnDestroy() {
    this.members = [];
  }

  private async getMembers() {
    if (!this.teamId) return;
    try {
      this.loading = true;
      const res = await this.api.getOverviewMembersByTeam(this.teamId, this.service.getIncludeToggle());
      if (res.done) {
        this.members = res.body;
        this.length.emit(this.members.length);
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  trackBy(index: number, data: IRPTMember) {
    return data.id;
  }

  openMember(member: IRPTMember) {
    this.selectMember.emit(member);
  }
}
