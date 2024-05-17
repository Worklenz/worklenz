import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  Renderer2
} from '@angular/core';

import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {UtilsService} from "@services/utils.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {filter, merge} from "rxjs";
import {TaskListHashMapService} from "../../task-list-hash-map.service";

import {TaskListV2Service} from "../../task-list-v2.service";
import {ITaskListEstimationChangeResponse} from "../../interfaces";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ITaskListStatusChangeResponse} from '@interfaces/task-list-status-change-response';

@Component({
  selector: 'worklenz-task-list-row',
  templateUrl: './task-list-row.component.html',
  styleUrls: ['./task-list-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListRowComponent implements OnInit, OnDestroy {
  @Input({required: true}) task!: IProjectTask;
  @HostBinding("class") cls = "position-relative task-row";

  @Output() onShowSubTasks = new EventEmitter<IProjectTask>();
  @Output() onOpenTask = new EventEmitter<IProjectTask>();

  private readonly highlight = 'highlight-col';
  protected readonly Number = Number;

  // Selected for edit
  protected editId: string | null = null;

  protected selected = false;

  protected keyActive = false;
  protected descriptionActive = false;
  protected progressActive = false;
  protected assigneesActive = false;
  protected labelsActive = false;
  protected phaseActive = false;
  protected statusActive = false;
  protected priorityActive = false;
  protected timeTrackingActive = false;
  protected estimationActive = false;
  protected startDateActive = false;
  protected dueDateActive = false;
  protected completedDateActive = false;
  protected createdDateActive = false;
  protected lastUpdatedActive = false;
  protected reporterActive = false;

  public get id() {
    return this.task.id;
  }

  constructor(
    private readonly element: ElementRef,
    private readonly renderer: Renderer2,
    public readonly service: TaskListV2Service,
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly map: TaskListHashMapService,
    private readonly ngZone: NgZone,
    private readonly view: TaskViewService,
    public readonly utils: UtilsService
  ) {
    this.service.onColumnsChange$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.markForCheck();
        this.updateState();
      });

    merge(
      this.map.onSelect$.pipe(
        filter(value => value.id === this.id),
        filter(() => !this.selected)
      ),
      this.map.onDeselect$.pipe(
        filter(value => value.id === this.id),
        filter(() => this.selected)
      ),
      this.map.onDeselectAll$.pipe(
        filter(() => this.selected)
      )
    ).pipe(
      takeUntilDestroyed()
    ).subscribe(value => {
      this.selected = !this.selected;
      this.toggleSelection();
      this.markForCheck();
    });

    this.view.onCommentsChange
      .pipe(
        filter(value => value.task === this.task.id),
        takeUntilDestroyed()
      )
      .subscribe(value => {
        this.task.comments_count = value.count;
        this.cdr.markForCheck();
      });

    this.view.onAttachmentsChange
      .pipe(
        filter(value => value.task === this.task.id),
        takeUntilDestroyed()
      )
      .subscribe(value => {
        this.task.attachments_count = value.count;
        this.cdr.markForCheck();
      });

    this.view.onTaskSubscriberChange$
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.subscriberChange(value.taskId, value.subscribers);
      });
  }

  private toggleSelection() {
    this.ngZone.runOutsideAngular(() => {
      const cls = "selected";
      const ele = this.element.nativeElement;

      if (this.selected) {
        this.renderer.addClass(ele, cls);
      } else {
        this.renderer.removeClass(ele, cls);
      }
    });
  }

  ngOnInit() {
    this.updateState();
    this.registerSocketEvents();
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleCompletedAt);
  }

  ngOnDestroy() {
    this.unregisterSocketEvents();
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleCompletedAt);
  }

  private updateState() {
    this.keyActive = this.active(this.service.COLUMN_KEYS.KEY);
    this.descriptionActive = this.active(this.service.COLUMN_KEYS.DESCRIPTION);
    this.progressActive = this.active(this.service.COLUMN_KEYS.PROGRESS);
    this.assigneesActive = this.active(this.service.COLUMN_KEYS.ASSIGNEES);
    this.labelsActive = this.active(this.service.COLUMN_KEYS.LABELS);
    this.statusActive = this.active(this.service.COLUMN_KEYS.STATUS);
    this.priorityActive = this.active(this.service.COLUMN_KEYS.PRIORITY);
    this.timeTrackingActive = this.active(this.service.COLUMN_KEYS.TIME_TRACKING);
    this.estimationActive = this.active(this.service.COLUMN_KEYS.ESTIMATION);
    this.startDateActive = this.active(this.service.COLUMN_KEYS.START_DATE);
    this.dueDateActive = this.active(this.service.COLUMN_KEYS.DUE_DATE);
    this.completedDateActive = this.active(this.service.COLUMN_KEYS.COMPLETED_DATE);
    this.createdDateActive = this.active(this.service.COLUMN_KEYS.CREATED_DATE);
    this.lastUpdatedActive = this.active(this.service.COLUMN_KEYS.LAST_UPDATED);
    this.reporterActive = this.active(this.service.COLUMN_KEYS.REPORTER);
    this.phaseActive = this.active(this.service.COLUMN_KEYS.PHASE);
  }

  private registerSocketEvents() {
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
    this.socket.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.handleEstimationChangeResponse);
  }

  private unregisterSocketEvents() {
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
    this.socket.removeListener(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.handleEstimationChangeResponse);
  }

  private active(key: string) {
    return this.service.canActive(key);
  }

  @HostListener("contextmenu", ["$event"])
  private onContextMenu(event: MouseEvent) {
    this.service.emitOnContextMenu(event, this.task);
  }

  focus(tr: HTMLDivElement) {
    setTimeout(() => {
      const element = tr.querySelector("input");
      element?.focus();
    });
  }

  onCheckChange(checked: boolean) {
    if (checked) {
      this.map.selectTask(this.task);
    } else {
      this.map.deselectTask(this.task);
    }

    this.toggleSelection();
  }

  openSubTasks() {
    this.onShowSubTasks?.emit(this.task);
  }

  openTask(task: IProjectTask) {
    this.onOpenTask?.emit(task);
  }

  selectCol(element: HTMLDivElement) {
    if (element.classList.contains(this.highlight)) return;
    element.classList.add(this.highlight);
  }

  deselectCol(element: HTMLDivElement) {
    element.classList.remove(this.highlight);
    this.editId = null;
  }

  handleNameChange(data?: IProjectTask) {
    if (!data) return;
    this.socket.emit(SocketEvents.TASK_NAME_CHANGE.toString(), JSON.stringify({
      task_id: data.id,
      name: data.name,
      parent_task: this.task.parent_task_id
    }));
    this.editId = null;
  }

  onTaskNameClick(event: MouseEvent, tr1: HTMLDivElement, task: IProjectTask) {
    event.stopPropagation();
    this.focus(tr1);
    this.editId = task.id || null;
  }

  public markForCheck() {
    this.cdr.markForCheck();
  }

  public detectChanges() {
    this.cdr.detectChanges();
  }

  public onDragStart() {
    this.map.deselectAll();
    this.detectChanges();
  }

  private handleNameChangeResponse = (response: { id: string; parent_task: string; name: string; }) => {
    if (!response) return;
    if (this.id !== response.id) return;

    if (this.task && this.task.name != response.name) {
      this.task.name = response.name;
      this.markForCheck();
    }
  };

  private handleEstimationChangeResponse = (response: ITaskListEstimationChangeResponse) => {
    if (response.id === this.id) {
      this.task.total_time_string = response.total_time_string;
      this.cdr.markForCheck();
    }
  };

  private subscriberChange = (taskId: string, subscribers: number) => {
    if (!taskId) return;
    if (this.id !== taskId) return;

    if (subscribers == 0 || subscribers < 0) {
      this.task.has_subscribers = false;
    } else {
      this.task.has_subscribers = true;
    }

    this.cdr.markForCheck();
  }

  private handleCompletedAt = (response: ITaskListStatusChangeResponse) => {
    if (!response.id) return;
    if (this.id !== response.id) return;
    this.task.completed_at = response.completed_at;
  }

}
