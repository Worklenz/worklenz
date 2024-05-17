import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  ViewChild
} from '@angular/core';
import {IPTTask} from "../../../interfaces";
import {ALPHA_CHANNEL} from "@shared/constants";
import {ITaskLabel} from "@interfaces/task-label";
import {PtTaskListService} from "../../../services/pt-task-list.service";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {AuthService} from "@services/auth.service";
import {Socket} from "ngx-socket-io";
import {UtilsService} from "@services/utils.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {SocketEvents} from "@shared/socket-events";
import {ILabelsChangeResponse} from "../../../../../modules/task-list-v2/interfaces";

@Component({
  selector: 'worklenz-task-labels',
  templateUrl: './task-labels.component.html',
  styleUrls: ['./task-labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskLabelsComponent {
  @ViewChild('labelsSearchInput', {static: false}) labelsSearchInput!: ElementRef<HTMLInputElement>;
  @Input() task: IPTTask = {};
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
    public readonly service: PtTaskListService
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
    this.socket.on(SocketEvents.PT_TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.on(SocketEvents.PT_CREATE_LABEL.toString(), this.handleLabelsChange);
  }

  ngOnDestroy() {
    this.labels = [];
    this.socket.removeListener(SocketEvents.PT_TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.removeListener(SocketEvents.PT_CREATE_LABEL.toString(), this.handleLabelsChange);
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
    this.socket.emit(SocketEvents.PT_TASK_LABELS_CHANGE.toString(), JSON.stringify({
      task_id: this.task.id,
      label_id: label.id,
      parent_task: this.task.parent_task_id
    }));

    this.sortBySelected(this.labels);
  }

  createLabel() {
    if (this.hasFilteredLabel || !this.searchText) return;

    const session = this.auth.getCurrentSession();
    this.socket.emit(SocketEvents.PT_CREATE_LABEL.toString(), JSON.stringify({
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
