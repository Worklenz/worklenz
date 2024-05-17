import {ChangeDetectionStrategy, ChangeDetectorRef, Component, HostBinding, Input} from '@angular/core';
import {TasksLogTimeService} from "@api/tasks-log-time.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskLogViewModel} from "@interfaces/api-models/task-log-create-request";
import moment from "moment";
import {time} from "html2canvas/dist/types/css/types/time";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-list-timer',
  templateUrl: './task-list-timer.component.html',
  styleUrls: ['./task-list-timer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListTimerComponent {
  @Input() task: IProjectTask = {};
  @HostBinding("class") cls = "flex-row task-time-tracking justify-content-center";

  timeLogs: ITaskLogViewModel[] = [];

  loading = false;

  readonly dateFormat = 'MMM d, y, h:mm:ss a';

  constructor(
    private readonly api: TasksLogTimeService,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
  ) {
  }

  private format(duration: moment.Duration, showSeconds: boolean) {
    const format = `h[h] m[m] ${showSeconds ? "s[s]" : ""}`;
    return moment.utc(duration.asMilliseconds()).format(
      duration.hours() > 0 ? format : "m[m] s[s]"
    );
  }

  private buildText(models: ITaskLogViewModel[]) {
    for (const model of models) {
      const duration = moment.duration(model.time_spent, "seconds");
      model.time_spent_text = this.format(duration, model.logged_by_timer || false);
    }
  }

  async handleVisibleChange(visible: boolean, task: IProjectTask) {
    try {
      if (!task.id) return;
      if (visible) {
        this.loading = true;
        const res = await this.api.getByTask(task.id, this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name as string : Intl.DateTimeFormat().resolvedOptions().timeZone);
        if (res.done) {
          const data = res.body;
          this.buildText(data);
          this.timeLogs = data;
        }
      } else {
        this.timeLogs = [];
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.detectChanges();
  }
}
