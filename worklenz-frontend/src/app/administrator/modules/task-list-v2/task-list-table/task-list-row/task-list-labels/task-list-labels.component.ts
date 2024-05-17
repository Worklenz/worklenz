import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskLabel} from "@interfaces/task-label";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {AuthService} from "@services/auth.service";
import {ALPHA_CHANNEL} from "@shared/constants";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {TaskListV2Service} from "../../../task-list-v2.service";
import {UtilsService} from "@services/utils.service";
import {ILabelsChangeResponse} from "../../../interfaces";
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-task-list-labels',
  templateUrl: './task-list-labels.component.html',
  styleUrls: ['./task-list-labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListLabelsComponent implements OnInit, OnDestroy {
  @ViewChild('labelsSearchInput', {static: false}) labelsSearchInput!: ElementRef<HTMLInputElement>;
  @Input() task: IProjectTask = {};
  @HostBinding("class") cls = "flex-row task-labels";

  readonly alpha = ALPHA_CHANNEL;

  searchText: string | null = null;

  labels: ITaskLabel[] = [];

  show = false;

  get hasFilteredLabel() {
    return !!this.filteredLabels.length;
  }

  get filteredLabels() {
    return this.searchPipe.transform(this.labels, this.searchText);
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly searchPipe: SearchByNamePipe,
    private readonly auth: AuthService,
    private readonly socket: Socket,
    private readonly utils: UtilsService,
    private readonly ngZone: NgZone,
    private readonly kanbanService: KanbanV2Service,
    public readonly service: TaskListV2Service
  ) {
    this.service.onLabelsChange$
      .pipe(takeUntilDestroyed())
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
    this.socket.removeListener(SocketEvents.TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.removeListener(SocketEvents.CREATE_LABEL.toString(), this.handleLabelsChange);
  }

  private updateLabels() {
    this.labels = this.service.labels;
  }

  trackById(index: number, item: ITaskLabel) {
    return item.id;
  }

  private sortBySelected(labels: ITaskLabel[]) {
    this.utils.sortBySelection(labels);
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
      this.kanbanService.emitRefreshGroups();
      this.cdr.markForCheck();
    }
  }

  handleLabelsVisibleChange(visible: boolean, tr: HTMLDivElement) {
    this.show = visible;
    visible ? tr.classList.add(this.service.HIGHLIGHT_COL_CLS) : tr.classList.remove(this.service.HIGHLIGHT_COL_CLS);
    if (visible) {
      const labels = this.task.all_labels?.map(l => l.id) ?? [];
      for (const label of this.labels)
        label.selected = labels.includes(label.id);
      this.focusLabelsSearchInput();
    } else {
      this.searchText = null;
      for (const label of this.labels)
        label.selected = false;
    }

    this.sortBySelected(this.labels);
  }

  private focusLabelsSearchInput() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.labelsSearchInput?.nativeElement?.focus();
      }, 100);
    });
  }

  handleLabelChange(label: ITaskLabel) {
    this.socket.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), JSON.stringify({
      task_id: this.task.id,
      label_id: label.id,
      parent_task: this.task.parent_task_id
    }));

    this.sortBySelected(this.labels);
  }

  createLabel() {
    if (this.hasFilteredLabel || !this.searchText) return;

    const session = this.auth.getCurrentSession();
    this.socket.emit(SocketEvents.CREATE_LABEL.toString(), JSON.stringify({
      task_id: this.task.id,
      label: this.searchText.trim(),
      team_id: session?.team_id,
      parent_task: this.task.parent_task_id
    }));
    this.searchText = null;

    this.cdr.detectChanges();
  }

  closeDropdown() {
    this.ngZone.runOutsideAngular(() => {
      document.body.click();
    });
  }
}
