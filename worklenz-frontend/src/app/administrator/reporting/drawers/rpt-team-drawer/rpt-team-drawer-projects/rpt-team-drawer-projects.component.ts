import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {IRPTOverviewProject} from "../../../interfaces";

@Component({
  selector: 'worklenz-rpt-team-drawer-projects',
  templateUrl: './rpt-team-drawer-projects.component.html',
  styleUrls: ['./rpt-team-drawer-projects.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptTeamDrawerProjectsComponent {
  @Input({required: true}) teamId!: string;
  @Input() teamMemberId!: string;

  @Output() length = new EventEmitter<number>();
  @Output() selectProject = new EventEmitter<IRPTOverviewProject>();
}
