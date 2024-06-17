import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import {TaskViewService} from "../task-view.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {EditorComponent} from "@tinymce/tinymce-angular";

declare const tinymce: any;

@Component({
  selector: 'worklenz-task-view-description',
  templateUrl: './task-view-description.component.html',
  styleUrls: ['./task-view-description.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewDescriptionComponent implements OnInit, OnDestroy {
  @ViewChild("descriptionInput", {static: false}) descriptionInput!: ElementRef;
  @ViewChild("descriptionEditor", {static: false}) descriptionEditor!: EditorComponent;

  readonly CONFIG = {
    base_url: '/tinymce',
    suffix: '.min',
    plugins: "lists link code wordcount",
    toolbar: 'blocks bold italic underline strikethrough | checklist numlist bullist link | alignleft aligncenter alignright alignjustify',
    menubar: false,
    content_css: "/assets/css/prebuilt-editor.css",
    statusbar: true,
    branding: false,
    height: this.service.model.task?.description?.length ? "300" : "200",
    // min_height: "100"
  };

  isEditing = false;
  saving = false;
  isSaveButtonActive = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    public readonly service: TaskViewService
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), this.handleResponse);
  }

  isEmpty() {
    return !this.service.model.task?.description?.length;
  }

  onDescriptionInputBlur() {
    this.toggleEdit(false);
    this.handleDescriptionChange();
  }

  toggleEdit(editing = false) {
    this.isEditing = editing;
    if (editing) {
      setTimeout(() => {
        tinymce.get(this.descriptionEditor.id)?.focus();
      });
    }

    this.cdr.detectChanges();
  }

  handleDescriptionChange() {
    const task = this.service.model.task;
    if (!task?.id) return;
    this.socket.emit(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), JSON.stringify({
      task_id: task.id,
      description: this.service.model.task?.description || null,
      parent_task: task.parent_task_id,
    }));
    this.cdr.detectChanges();
  }

  private handleResponse = (response: { id: string; parent_task: string; description: string; }) => {
    if (!response) return;
    if (this.service.model.task && this.service.model.task.description != response.description) {
      this.service.model.task.description = response.description;
    }
    setTimeout(() => this.cdr.detectChanges());
  }
}
