import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input, NgZone, OnDestroy, OnInit,
  ViewChild
} from '@angular/core';
import {IPTTask} from "../../../interfaces";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {PtTaskListService} from "../../../services/pt-task-list.service";
import {EditorComponent} from "@tinymce/tinymce-angular";

@Component({
  selector: 'worklenz-task-description',
  templateUrl: './task-description.component.html',
  styleUrls: ['./task-description.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskDescriptionComponent implements OnInit, OnDestroy {
  @ViewChild("descriptionInput", {static: false}) descriptionInput!: ElementRef;
  @ViewChild("descriptionEditor", {static: false}) descriptionEditor!: EditorComponent;

  @Input() task: IPTTask = {};
  @HostBinding("class") cls = "flex-row task-description p-0";
  show = false;
  loading = false;

  readonly CONFIG = {
    base_url: '/tinymce',
    suffix: '.min',
    plugins: "lists link code wordcount",
    toolbar: 'blocks bold italic underline strikethrough | checklist numlist bullist link | alignleft aligncenter alignright alignjustify',
    menubar: false,
    content_css: "/assets/css/prebuilt-editor.css",
    statusbar: true,
    branding: false,
    height: 200,
    min_height: 100
  };

  isEditing = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    public readonly service: PtTaskListService,
    private readonly ngZone: NgZone,
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.PT_TASK_DESCRIPTION_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PT_TASK_DESCRIPTION_CHANGE.toString(), this.handleResponse);
  }

  private handleResponse = (response: { id: string; description: string; }) => {
    if (this.task.id === response?.id) {
      this.task.description = response.description;
      this.closeDropdown();
      this.cdr.markForCheck();
    }
  };

  handleVisibleChange(visible: boolean, tr: HTMLDivElement) {
    this.show = visible;
    visible ? tr.classList.add(this.service.HIGHLIGHT_COL_CLS) : tr.classList.remove(this.service.HIGHLIGHT_COL_CLS);
  }

  submit() {
    this.socket.emit(SocketEvents.PT_TASK_DESCRIPTION_CHANGE.toString(), JSON.stringify({
      task_id: this.task.id,
      description: this.task.description
    }));
  }

  closeDropdown() {
    this.ngZone.runOutsideAngular(() => {
      document.body.click();
    });
  }

}
