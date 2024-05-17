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
import {IWLMemberTask} from "@interfaces/workload";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";

@Component({
  selector: 'worklenz-task-name',
  templateUrl: './task-name.component.html',
  styleUrls: ['./task-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskNameComponent implements OnInit, OnDestroy {
  @ViewChild('input') input!: ElementRef;
  @Input({required: true}) task: IWLMemberTask | null = null;
  @Output() openTask = new EventEmitter<IWLMemberTask>();

  initialTaskName: string | null = null;

  isEditing = false;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
  ) {
  }

  ngOnInit() {
    if (this.task?.task_name) this.initialTaskName = this.task.task_name;
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
    if (this.task && this.task.task_name.trim() === '') {
      this.task.task_name = this.initialTaskName as string;
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
        task_id: this.task.task_id,
        name: this.task.task_name,
        parent_task: null,
      }));
    this.isEditing = false;
  }

  private handleResponse = (response: { id: string; parent_task: string; name: string; }) => {
    if (!response) return;
    if (this.task?.task_id !== response.id) return;

    if (this.task && this.task.task_name != response.name) {
      this.task.task_name = response.name;
      this.cdr.markForCheck();
    }
  };

}
