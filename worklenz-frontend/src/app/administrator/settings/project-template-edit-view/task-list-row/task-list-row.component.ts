import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding, HostListener,
  Input, NgZone,
  Output,
  Renderer2
} from '@angular/core';
import {IPTTask} from "../interfaces";
import {PtTaskListService} from "../services/pt-task-list.service";
import {Socket} from "ngx-socket-io";
import {PtTaskListHashMapService} from "../services/pt-task-list-hash-map.service";
import {UtilsService} from "@services/utils.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {filter, merge} from "rxjs";
import {SocketEvents} from "@shared/socket-events";
import {ITaskListEstimationChangeResponse} from "../../../modules/task-list-v2/interfaces";

@Component({
  selector: 'worklenz-pt-task-list-row',
  templateUrl: './task-list-row.component.html',
  styleUrls: ['./task-list-row.component.scss']
})
export class TaskListRowComponent {
  @Input({required: true}) task!: IPTTask;
  @HostBinding("class") cls = "position-relative task-row";

  @Output() onShowSubTasks = new EventEmitter<IPTTask>();

  private readonly highlight = 'highlight-col';
  protected readonly Number = Number;

  // Selected for edit
  protected editId: string | null = null;

  protected selected = false;

  public get id() {
    return this.task.id;
  }

  constructor(
    private readonly element: ElementRef,
    private readonly renderer: Renderer2,
    private readonly cdr: ChangeDetectorRef,
    public readonly service: PtTaskListService,
    private readonly socket: Socket,
    private readonly map: PtTaskListHashMapService,
    private readonly ngZone: NgZone,
    public readonly utils: UtilsService
  ) {
    this.service.onColumnsChange$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.markForCheck();
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
    this.socket.on(SocketEvents.PT_TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
    this.socket.on(SocketEvents.PT_TASK_TIME_ESTIMATION_CHANGE.toString(), this.handleEstimationChangeResponse);
  }

  private unregisterSocketEvents() {
    this.socket.removeListener(SocketEvents.PT_TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
    this.socket.removeListener(SocketEvents.PT_TASK_TIME_ESTIMATION_CHANGE.toString(), this.handleEstimationChangeResponse);
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

  selectCol(element: HTMLDivElement) {
    if (element.classList.contains(this.highlight)) return;
    element.classList.add(this.highlight);
  }

  deselectCol(element: HTMLDivElement) {
    element.classList.remove(this.highlight);
    this.editId = null;
  }

  handleNameChange(data?: IPTTask) {
    if (!data) return;
    this.socket.emit(SocketEvents.PT_TASK_NAME_CHANGE.toString(), JSON.stringify({
      task_id: data.id,
      name: data.name,
      parent_task: this.task.parent_task_id
    }));
    this.editId = null;
  }

  onTaskNameClick(event: MouseEvent, tr1: HTMLDivElement, task: IPTTask) {
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

}
