import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import {ITaskAttachmentViewModel} from "@interfaces/api-models/task-attachment-view-model";
import {AttachmentsApiService} from "@api/attachments-api.service";
import {getBase64, log_error} from "@shared/utils";
import {ITaskAttachment} from "@interfaces/api-models/task-attachment";
import {TaskViewService} from "../task-view.service";

@Component({
  selector: 'worklenz-task-view-attachments',
  templateUrl: './task-view-attachments.component.html',
  styleUrls: ['./task-view-attachments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewAttachmentsComponent implements OnInit, OnDestroy {
  fileList: ITaskAttachmentViewModel[] = [];

  @Output() onFileRemoved: EventEmitter<string> = new EventEmitter<string>();
  @Output() onFileUploaded: EventEmitter<string> = new EventEmitter<string>(); // sends uploaded file id
  @Output() uploadingChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  uploading = false;
  loading = false;

  get taskId() {
    return this.service.model.task?.id;
  }

  get projectId() {
    return this.service.model.task?.project_id;
  }

  constructor(
    private readonly api: AttachmentsApiService,
    private readonly service: TaskViewService,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit(): void {
    void this.get();
  }

  ngOnDestroy() {
    this.fileList = [];
  }

  async get() {
    if (!this.taskId) return;
    try {
      const res = await this.api.getTaskAttachment(this.taskId);
      if (res.done) {
        this.fileList = res.body;

        if (this.service.model.task)
          this.service.model.task.attachments_count = this.fileList.length;

        this.cdr.detectChanges();
      }
    } catch (e) {
      log_error(e);
    }
  }

  async delete(id?: string) {
    if (!id) return;

    // Send remove event for new tasks update the attachment list
    this.onFileRemoved.emit(id);

    // Continue to delete from the server for previous tasks
    try {
      const res = await this.api.deleteTaskAttachment(id);
      if (res.done) {
        if (this.taskId) {
          await this.get();
          this.service.emitAttachmentsChange(this.taskId, this.service.model.task?.attachments_count || 0);
        } else {
          const index = this.fileList.findIndex(f => f.id === id);
          this.fileList.splice(index, 1);
          this.cdr.detectChanges();
        }
      }
    } catch (e) {
      log_error(e);
    }
  }

  async uploadFile(input: HTMLInputElement) {
    const files = input.files || [];

    if (!files?.length) return;
    if (!this.projectId) return;

    const file = files[0];

    this.uploading = true;
    this.uploadingChange.emit(true);

    try {
      const data = await getBase64(file);
      const body: ITaskAttachment = {
        file: data as string,
        file_name: file.name,
        task_id: this.taskId,
        project_id: this.projectId,
        size: file.size
      };
      const res = await this.api.createTaskAttachment(body);

      if (res.done && res.body) {
        this.onFileUploaded.emit(res.body.id);
        if (this.taskId) {
          await this.get();
          this.service.emitAttachmentsChange(this.taskId, this.service.model.task?.attachments_count || 0);
        } else {
          this.fileList.push(res.body);
        }
      }
      this.uploading = false;
      this.uploadingChange.emit(false);
    } catch (e) {
      this.uploading = false;
      this.uploadingChange.emit(false);
      log_error(e);
    }

    // Reset file input
    const dt = new DataTransfer();
    input.files = dt.files;

    this.cdr.detectChanges();
  }

  async onDrop(event: any, input: HTMLInputElement, uploadBtn: HTMLDivElement) {
    event.preventDefault();
    input.files = event.dataTransfer.files;
    await this.uploadFile(input);
    this.focusButton(false, uploadBtn);
  }
  onDragOver(event: any, uploadBtn: HTMLDivElement) {
      event.stopPropagation();
      event.preventDefault();
      this.focusButton(true, uploadBtn);
  }

  focusButton(value: boolean, btn: HTMLDivElement) {
    if(value) {
      btn.classList.add('focused');
    } else {
      btn.classList.remove('focused');
    }
  }

}
