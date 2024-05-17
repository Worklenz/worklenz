import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input} from '@angular/core';
import {IMyTask} from "@interfaces/my-tasks";
import {HomePageApiService} from "@api/home-page-api.service";
import {log_error} from "@shared/utils";
import {HomepageService} from "../../../../homepage-service.service";

@Component({
  selector: 'worklenz-task-done',
  templateUrl: './task-done.component.html',
  styleUrls: ['./task-done.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskDoneComponent {
  @Input() task: IMyTask | null = null;
  loading = false;

  constructor(
    private readonly api: HomePageApiService,
    private readonly service: HomepageService,
    private readonly cdr: ChangeDetectorRef,
  ) {
  }

  async markAsDone() {
    if (!this.task?.id) return;
    try {
      this.loading = true;
      const res = await this.api.taskMarkAsDone(this.task.id);
      if (res) {
        this.service.emitRemoveTaskFromList(res.body);
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e)
    }
    this.loading = false;
    this.cdr.markForCheck();
  }
}
