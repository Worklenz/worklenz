import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {FormBuilder, FormGroup} from "@angular/forms";
import {ITaskLabel} from "@interfaces/task-label";
import {AuthService} from "@services/auth.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {TaskListV2Service} from "../../../modules/task-list-v2/task-list-v2.service";
import {TaskViewService} from "../task-view.service";
import {SearchByNamePipe} from "../../../../pipes/search-by-name.pipe";
import {UtilsService} from "@services/utils.service";

@Component({
  selector: 'worklenz-task-view-labels',
  templateUrl: './task-view-labels.component.html',
  styleUrls: ['./task-view-labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewLabelsComponent implements OnInit, OnDestroy {
  @ViewChild('labelSearchInput', {static: false}) labelSearchInput!: ElementRef<HTMLInputElement>;

  form!: FormGroup;

  labelsSearchText: string | null = null;

  get hasFilteredLabel() {
    return !!this.filteredLabels.length;
  }

  get filteredLabels() {
    return this.searchPipe.transform(this.taskListService.labels, this.labelsSearchText);
  }

  constructor(
    private readonly socket: Socket,
    private readonly fb: FormBuilder,
    private readonly ref: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly ngZone: NgZone,
    public readonly service: TaskViewService,
    public readonly taskListService: TaskListV2Service,
    private readonly searchPipe: SearchByNamePipe,
    private readonly utils: UtilsService
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.on(SocketEvents.CREATE_LABEL.toString(), this.handleLabelsChange);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.removeListener(SocketEvents.CREATE_LABEL.toString(), this.handleLabelsChange);
  }

  private sortBySelected(labels: ITaskLabel[]) {
    this.utils.sortBySelection(labels);
  }

  handleLabelsVisibleChange(visible: boolean) {
    if (!this.service.model.task) return;
    const labels: ITaskLabel[] = this.taskListService.labels?.length ? [...this.taskListService.labels] : [];

    if (visible) {
      const taskLabels = this.service.model.task.labels?.map((l) => l.id) || [];
      for (const label of labels)
        label.selected = taskLabels.includes(label.id);
      this.focusLabelsSearchInput();
    } else {
      for (const label of labels) label.selected = false;
    }

    this.taskListService.labels = labels;
    this.sortBySelected(labels);
    this.ref.detectChanges();
  }

  private focusLabelsSearchInput() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.labelSearchInput?.nativeElement?.focus();
      }, 100);
    });
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  handleLabelChange(item: ITaskLabel) {
    const task = this.service.model.task;
    if (!task || !task?.id) return;
    this.socket.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), JSON.stringify({
      task_id: task.id,
      label_id: item.id,
      parent_task: task.parent_task_id,
    }));
    if(this.service.model.task?.labels) this.sortBySelected(this.service.model.task?.labels);
    this.ref.detectChanges();
  }

  private handleLabelsChange = (response: {
    id: string; parent_task: string; is_new: boolean, new_label: ITaskLabel,
    all_labels: ITaskLabel[],
    labels: ITaskLabel[]
  }) => {
    if (this.service.model.task) {
      this.service.model.task.labels = response.all_labels;
      this.sortBySelected(this.service.model.task.labels);
      this.ref.detectChanges();
      this.service.emitRefresh(response.id);
    }
  }

  createLabel() {
    const task = this.service.model.task;
    if (!task || !task.id || this.hasFilteredLabel || !this.labelsSearchText) return;
    const session = this.auth.getCurrentSession();
    this.socket.emit(SocketEvents.CREATE_LABEL.toString(), JSON.stringify({
      task_id: task?.id,
      label: this.labelsSearchText,
      team_id: session?.team_id,
      parent_task: task?.parent_task_id,
    }));
    this.labelsSearchText = null;
    this.ref.detectChanges();
  }
}
