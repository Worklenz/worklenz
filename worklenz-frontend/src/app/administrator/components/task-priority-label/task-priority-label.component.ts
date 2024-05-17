import {Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzTypographyModule} from "ng-zorro-antd/typography";

@Component({
  selector: 'worklenz-task-priority-label',
  standalone: true,
  imports: [CommonModule, NzIconModule, NzTypographyModule],
  templateUrl: './task-priority-label.component.html',
  styleUrls: ['./task-priority-label.component.scss']
})
export class TaskPriorityLabelComponent {
  @Input() name!: string;
}
