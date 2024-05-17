import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {IRPTOverviewProject} from "../../../interfaces";

@Component({
  selector: 'worklenz-rpt-member-drawer-projects',
  templateUrl: './rpt-member-drawer-projects.component.html',
  styleUrls: ['./rpt-member-drawer-projects.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptMemberDrawerProjectsComponent {
  @Input({required: true}) teamId!: string;
  @Input({required: true}) teamMemberId!: string;

  @Output() selectProject = new EventEmitter<IRPTOverviewProject>();

  onSelectProject(project: IRPTOverviewProject) {
    this.selectProject.emit(project);
  }

}
