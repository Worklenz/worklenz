import {Injectable} from "@angular/core";
import {Title} from "@angular/platform-browser";
import {NzNotificationService} from 'ng-zorro-antd/notification';
import {FormGroup} from "@angular/forms";
import {UtilsService} from "@services/utils.service";

@Injectable({
  providedIn: "root"
})
export class AppService {

  // To show activity Indicator while loading a lazy loaded Module
  private loadingPath: string | null = null;

  private messagesMap = new Map<string, boolean>();

  constructor(
    private readonly title: Title,
    private readonly notification: NzNotificationService,
    private readonly utils: UtilsService
  ) {
  }

  public setTitle(title: string): void {
    this.title.setTitle(`Worklenz | ${title}`);
  }

  public setLoadingPath(path: string | null) {
    if (!path) return;
    this.loadingPath = path;
  }

  public displayErrorsOf(form: FormGroup) {
    if (!form) return;
    Object.values(form.controls).forEach(control => {
      if (control.invalid) {
        control.markAsDirty();
        control.updateValueAndValidity({onlySelf: true});
      }
    });
  }

  notify(title: string, message: string, done: boolean) {
    if (this.messagesMap.has(message)) return;

    this.messagesMap.set(message, true);

    const safeTitle = this.utils.sanitizeHtml(title);
    const safeMessage = this.utils.sanitizeHtml(message);
    this.notification
      .blank(safeTitle || '', safeMessage || '', {
        nzCloseIcon: "",
        nzPlacement: "topRight",
        nzPauseOnHover: true,
        nzStyle: {
          "border-radius": "4px"
        }
      })
      .onClose.subscribe(next => {
      this.messagesMap.delete(message);
    });
  }
}
