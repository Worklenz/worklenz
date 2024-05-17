import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {WithPercentageMarkPipe} from "@admin/components/tasks-progress-bar/with-percentage-mark.pipe";

@Component({
  selector: 'worklenz-tasks-progress-bar',
  standalone: true,
  imports: [CommonModule, NzToolTipModule, NzTypographyModule, WithPercentageMarkPipe],
  templateUrl: './tasks-progress-bar.component.html',
  styleUrls: ['./tasks-progress-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TasksProgressBarComponent {
  todo = 0;
  doing = 0;
  done = 0;

  @Input() set todoProgress(value: number | undefined) {
    this.todo = value ?? 0;
  }

  @Input() set doingProgress(value: number | undefined) {
    this.doing = value ?? 0;
  }

  @Input() set doneProgress(value: number | undefined) {
    this.done = value ?? 0;
  }

  canDisplay() {
    return this.todo || this.doing || this.done;
  }
}
