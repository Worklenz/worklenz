import {ChangeDetectionStrategy, Component, Output, ViewChild} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {UtilsService} from "@services/utils.service";
import {TaskViewService} from "../task-view.service";
import {TaskViewCommentsComponent} from "../task-view-comments/task-view-comments.component";

@Component({
  selector: 'worklenz-task-view-info',
  templateUrl: './task-view-info.component.html',
  styleUrls: ['./task-view-info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewInfoComponent {
  @ViewChild("commentsView", {static: false}) commentsView!: TaskViewCommentsComponent;
  @Output()
  commentsInputFocused = false;

  constructor(
    private readonly route: ActivatedRoute,
    public readonly utils: UtilsService,
    public readonly service: TaskViewService
  ) {
  }

  isEditTask() {
    return !!this.service.model.task?.id;
  }

  isTaskAvailable() {
    return !!this.service.model.task;
  }

  getAttachmentsHeader() {
    const count = this.service.model.task?.attachments_count || 0;
    return `Attachments (${count})`;
  }

  isSubTask() {
    return !!this.service.model.task?.is_sub_task;
  }

  onCommentsInputFocus(focused: boolean) {
    this.commentsInputFocused = focused;
    setTimeout(() => {
      this.commentsView.scrollIntoView();
    }, 100);
  }

  refreshSubTasks(event: MouseEvent) {
    event.stopPropagation();
    this.service.emitSubTasksRefresh();
  }
}
