import {ChangeDetectionStrategy, Component, TemplateRef, ViewChild} from '@angular/core';
import {NzNotificationService} from "ng-zorro-antd/notification";
import {Router} from "@angular/router";
import {IWorklenzNotification} from "@interfaces/worklenz-notification";
import {NotificationSettingsService} from "@services/notification-settings.service";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {AuthService} from "@services/auth.service";
import {TeamsApiService} from "@api/teams-api.service";

@Component({
  selector: 'worklenz-notification-template',
  templateUrl: './notification-template.component.html',
  styleUrls: ['./notification-template.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationTemplateComponent {
  @ViewChild("template", {static: false}) templateRef!: TemplateRef<IWorklenzNotification>;
  @ViewChild("closeIcon", {static: false}) closeIconRef!: TemplateRef<never>;

  private session: ILocalSession | null = null;

  constructor(
    private readonly service: NzNotificationService,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly teamApi: TeamsApiService,
    private readonly settings: NotificationSettingsService
  ) {
    this.session = this.auth.getCurrentSession();
  }

  public show(data: IWorklenzNotification) {

    data.color = data.color || "#191919";

    const style = {
      cursor: "pointer",
      borderRadius: "15px",
      border: `2px solid ${data.color}4d`
    };

    const notificationRef = this.service.template(this.templateRef, {
      nzDuration: 5000,
      nzData: data,
      nzStyle: style,
      nzCloseIcon: this.closeIconRef
    });

    notificationRef.onClick.subscribe(async () => {
      this.service.remove(notificationRef.messageId);

      if (data.url) {
        if (this.session?.team_id !== data.team_id) {
          await this.teamApi.activate(data.team_id);
          await this.auth.authorize();
        }

        await this.router.navigate([data.url], {
          queryParams: data.params || null
        });
      }

      if (data.project && data.task_id)
        this.settings.emitNotificationClick({
          project: data.project,
          task: data.task_id
        });
    });
  }

  close(event: MouseEvent, notification: any) {
    event.stopPropagation();
    notification.close();
  }
}
