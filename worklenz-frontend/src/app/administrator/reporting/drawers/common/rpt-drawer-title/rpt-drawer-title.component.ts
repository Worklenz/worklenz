import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzIconModule} from "ng-zorro-antd/icon";

@Component({
  selector: 'worklenz-rpt-drawer-title',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  templateUrl: './rpt-drawer-title.component.html',
  styleUrls: ['./rpt-drawer-title.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptDrawerTitleComponent {
  @Input({required: true}) title!: string | null;
  @Input() icon: 'bank' | 'file' | null = null;
}
