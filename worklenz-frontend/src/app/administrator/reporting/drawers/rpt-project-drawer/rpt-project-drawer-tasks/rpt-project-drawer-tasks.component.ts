import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

@Component({
  selector: 'worklenz-rpt-project-drawer-tasks',
  templateUrl: './rpt-project-drawer-tasks.component.html',
  styleUrls: ['./rpt-project-drawer-tasks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptProjectDrawerTasksComponent {
  @Input({required: true}) projectId: string | null = null;
}
