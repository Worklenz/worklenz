import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  Output
} from "@angular/core";
import {ITaskAttachmentViewModel} from "@interfaces/api-models/task-attachment-view-model";
import {getFileIcon, log_error} from "@shared/utils";
import {AttachmentsApiService} from "@api/attachments-api.service";

@Component({
  selector: 'worklenz-task-view-attachments-thumb',
  templateUrl: './task-view-attachments-thumb.component.html',
  styleUrls: ['./task-view-attachments-thumb.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewAttachmentsThumbComponent {
  @Input() attachment: ITaskAttachmentViewModel | null = null;
  @Output() onDelete: EventEmitter<string> = new EventEmitter<string>();

  deleting = false;
  isVisible = false;
  currentFileUrl: string | null = null;
  currentFileType: string | null = null;
  previewWidth = 768;
  downloading = false;
  previewdFileId: string | null = null;
  previewdFileName: string | null = null;

  constructor(
    private readonly api: AttachmentsApiService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  async download(id?: string, name?: string) {
    if (!id || !name) return;
    try {
      this.downloading = true;
      const res = await this.api.download(id, name);
      if (res && res.done) {
        this.ngZone.runOutsideAngular(() => {
          const link = document.createElement('a');
          link.href = res.body;
          link.download = name;
          link.click();
          link.remove();
        });
      }
    } catch (e) {
      log_error(e);
      this.downloading = false;
    }
    this.downloading = false;
    this.cdr.markForCheck();
  }

  isImageFile() {
    const type = this.attachment?.type;
    return type === "jpeg" || type === "jpg" || type === "bmp" || type === "gif" || type === "webp" || type === "png" || type === "ico";
  }

  getFileIcon(type?: string) {
    return getFileIcon(type);
  }

  open(url?: string) {
    if (!url) return;
    this.isVisible = true;
    this.cdr.markForCheck();
  }

  delete(id?: string) {
    if (!id) return;
    this.deleting = true;
    this.onDelete.emit(id);
    this.cdr.markForCheck();
  }

  handleCancel() {
    this.isVisible = false;
    this.previewdFileId = null;
    this.previewdFileName = null;
    this.cdr.markForCheck();
  }

  previewFile(fileUrl?: string, id?: string, fileName?: string) {
    if (!fileUrl || !id || !fileName) return;

    this.previewdFileId = id;
    this.previewdFileName = fileName;

    const extension = (fileUrl as string).split('.').pop()?.toLowerCase();

    if (!extension) return;
    this.isVisible = true;
    if (this.isImage(extension)) {
      this.currentFileType = 'image';
    } else if (this.isVideo(extension)) {
      this.currentFileType = 'video';
    } else if (this.isAudio(extension)) {
      this.previewWidth = 600;
      this.currentFileType = 'audio';
    } else if (this.isDoc(extension)) {
      this.currentFileType = 'document';
    } else {
      this.previewWidth = 600;
      this.currentFileType = 'unknown';
    }

    this.currentFileUrl = fileUrl;
    this.cdr.markForCheck();
  }

  isImage(extension: string): boolean {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico'].includes(extension);
  }

  isVideo(extension: string): boolean {
    return ['mp4', 'webm', 'ogg'].includes(extension);
  }

  isAudio(extension: string): boolean {
    return ['mp3', 'wav', 'ogg'].includes(extension);
  }

  isDoc(extension: string): boolean {
    this.previewWidth = 1024;
    return ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'pdf'].includes(extension);
  }

}
