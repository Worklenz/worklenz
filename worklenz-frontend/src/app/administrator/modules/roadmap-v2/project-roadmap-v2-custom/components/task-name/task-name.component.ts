import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {RoadmapV2Service} from "../../services/roadmap-v2-service.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {merge} from "rxjs";

@Component({
  selector: 'worklenz-rm-task-name',
  templateUrl: './task-name.component.html',
  styleUrls: ['./task-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RMTaskNameComponent implements OnInit, OnDestroy {
  @ViewChild('input') input!: ElementRef;
  @Input({required: true}) task: IProjectTask | null = null;
  @Output() openTask = new EventEmitter<IProjectTask>();

  initialTaskName: string | null = null;

  isEditing = false;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly service: RoadmapV2Service
  ) {
    merge(this.service.onSubtaskAdd, this.service.onSubtaskDelete)
      .pipe(takeUntilDestroyed())
      .subscribe((task) => {
        this.cdr.detectChanges();
      })
  }

  ngOnInit() {
    if (this.task?.name) this.initialTaskName = this.task.name;
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleResponse);
  }

  enableEdit() {
    this.isEditing = true;
    setTimeout(() => {
      if (this.input) {
        this.input.nativeElement.focus();
      }
    }, 250);
  }

  validateName() {
    if (this.task && this.task.name?.trim() === '') {
      this.task.name = this.initialTaskName as string;
      this.isEditing = false;
      this.cdr.markForCheck();
      return;
    } else {
      this.changeName();
    }
  }

  changeName() {
    if (!this.task) return;
    this.socket.emit(
      SocketEvents.TASK_NAME_CHANGE.toString(), JSON.stringify({
        task_id: this.task.id,
        name: this.task.name,
        parent_task: null,
      }));
    this.isEditing = false;
  }

  private handleResponse = (response: { id: string; parent_task: string; name: string; }) => {
    if (!response) return;
    if (this.task?.id !== response.id) return;

    if (this.task && this.task.name != response.name) {
      this.task.name = response.name;
      this.cdr.markForCheck();
    }
  };
}
