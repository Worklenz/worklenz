import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

@Component({
  selector: 'worklenz-rpt-member-drawer-tasks',
  templateUrl: './rpt-member-drawer-tasks.component.html',
  styleUrls: ['./rpt-member-drawer-tasks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptMemberDrawerTasksComponent {
  @Input() projectId!: string | null;
  @Input({required: true}) teamMemberId!: string;
}
