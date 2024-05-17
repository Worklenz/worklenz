import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone, OnInit, Renderer2,
  ViewChild
} from '@angular/core';
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";

@Component({
  selector: 'worklenz-template-name',
  templateUrl: './template-name.component.html',
  styleUrls: ['./template-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateNameComponent implements OnInit {
  @ViewChild("input", {static: false}) input!: ElementRef<HTMLInputElement>;
  @Input({required: true}) templateId: string | null = null;
  @Input({required: true}) templateName: string | null = null;

  showInput = false
  isEmpty = false;

  constructor(
    private readonly socket: Socket,
    private readonly ngZone: NgZone,
    private readonly renderer: Renderer2,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.PT_NAME_CHANGE.toString(), this.handleResponse)
  }

  focusInput() {
    this.showInput = true;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (this.input) {
          this.input.nativeElement.focus();
          this.cdr.markForCheck();
        }
      }, 100);
    })
  }

  onBlur() {
    if (this.validate()) {
      this.changeName();
    }
  }


  validate() {
    if (this.templateName?.trim() === "" || !this.templateName) {
      this.isEmpty = true;
      return false;
    }
    this.isEmpty = false;
    return true;
  }

  changeName() {
    this.socket.emit(
      SocketEvents.PT_NAME_CHANGE.toString(), JSON.stringify({
        template_id: this.templateId,
        template_name: this.templateName
      })
    )
  }

  private handleResponse = (response: {
    template_id: string;
    template_name: string | null;
  }) => {
    if (response) {
      this.templateName = response.template_name;
      this.showInput = false;
      this.cdr.markForCheck();
    }
  };

}
