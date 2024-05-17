import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {IMyTask} from "@interfaces/my-tasks";

@Component({
  selector: 'worklenz-task-project',
  templateUrl: './task-project.component.html',
  styleUrls: ['./task-project.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskProjectComponent {
  @Input() task: IMyTask | null = null;
}
