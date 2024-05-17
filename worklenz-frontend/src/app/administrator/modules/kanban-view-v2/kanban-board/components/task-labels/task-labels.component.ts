import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {ITaskLabel} from '@interfaces/task-label';
import {ALPHA_CHANNEL} from '@shared/constants';
import {SocketEvents} from '@shared/socket-events';
import {ILabelsChangeResponse} from 'app/administrator/modules/task-list-v2/interfaces';
import {TaskListHashMapService} from 'app/administrator/modules/task-list-v2/task-list-hash-map.service';
import {TaskListV2Service} from 'app/administrator/modules/task-list-v2/task-list-v2.service';
import {Socket} from 'ngx-socket-io';
import {Subject, takeUntil} from 'rxjs';

@Component({
  selector: 'worklenz-kanban-task-labels',
  templateUrl: './task-labels.component.html',
  styleUrls: ['./task-labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskLabelsComponent implements OnInit, OnDestroy {
  @Input() task: IProjectTask = {};

  readonly alpha = ALPHA_CHANNEL;

  labels: ITaskLabel[] = [];
  labelsCount?: number | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    public readonly service: TaskListV2Service,
    private readonly map: TaskListHashMapService
  ) {
    this.service.onLabelsChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateLabels();
        this.cdr.markForCheck();
      });

  }

  ngOnInit() {
    this.updateLabels();
    this.socket.on(SocketEvents.TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.on(SocketEvents.CREATE_LABEL.toString(), this.handleLabelsChange);
  }

  ngOnDestroy() {
    this.labels = [];
    this.destroy$.next();
    this.destroy$.complete();
    this.socket.removeListener(SocketEvents.TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.removeListener(SocketEvents.CREATE_LABEL.toString(), this.handleLabelsChange);
  }

  private updateLabels() {
    this.labels = this.service.labels;
  }

  trackById(index: number, item: ITaskLabel) {
    return item.id;
  }

  private handleLabelsChange = (response: ILabelsChangeResponse) => {
    if (response && response.id === this.task.id) {
      this.task.labels = response.labels;
      this.task.all_labels = response.all_labels;

      if (response.new_label) {
        if (response.is_new) {
          const labels = [...this.service.labels];
          labels.push(response.new_label);
          this.service.labels = [...labels];
        } else {
          const label = this.labels.find(l => l.id === response.new_label.id);
          if (label)
            label.selected = true;
        }
      }
      this.cdr.markForCheck();
    }
  }

  handleLabelChange(label: ITaskLabel) {
    this.socket.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), JSON.stringify({
      task_id: this.task.id,
      label_id: label.id,
      parent_task: this.task.parent_task_id
    }));

  }

}
