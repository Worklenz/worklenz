import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef, EventEmitter, HostBinding, HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit, Output,
  Renderer2
} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {Socket} from "ngx-socket-io";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {UtilsService} from "@services/utils.service";
import {WlTasksService} from "../../services/wl-tasks.service";
import {WlTasksHashMapService} from "../../services/wl-tasks-hash-map.service";
import {SocketEvents} from "@shared/socket-events";
import {ITaskListStatusChangeResponse} from "@interfaces/task-list-status-change-response";
import {filter, merge} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-wl-task-list-row',
  templateUrl: './task-list-row.component.html',
  styleUrls: ['./task-list-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WLTaskListRowComponent implements OnInit, OnDestroy {
  @Input({required: true}) task!: IProjectTask;
  @Output() onShowSubTasks = new EventEmitter<IProjectTask>();
  @Output() onOpenTask = new EventEmitter<IProjectTask>();
  @HostBinding("class") cls = "position-relative task-row";

  private readonly highlight = 'highlight-col';

  protected editId: string | null = null;

  protected selected = false;

  protected readonly Number = Number;

  public get id() {
    return this.task.id;
  }

  constructor(
    private readonly element: ElementRef,
    private readonly renderer: Renderer2,
    public readonly service: WlTasksService,
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly map: WlTasksHashMapService,
    private readonly ngZone: NgZone,
    private readonly view: TaskViewService,
    public readonly utils: UtilsService
  ) {
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
    this.registerSocketEvents();
  }

  ngOnDestroy() {
    this.unregisterSocketEvents();
  }

  private registerSocketEvents() {
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
  }

  private unregisterSocketEvents() {
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
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

  private handleNameChangeResponse = (response: { id: string; parent_task: string; name: string; }) => {
    if (!response) return;
    if (this.id !== response.id) return;

    if (this.task && this.task.name != response.name) {
      this.task.name = response.name;
      this.markForCheck();
    }
  };

  private handleCompletedAt = (response: ITaskListStatusChangeResponse) => {
    if (!response.id) return;
    if (this.id !== response.id) return;
    this.task.completed_at = response.completed_at;
  }

}
