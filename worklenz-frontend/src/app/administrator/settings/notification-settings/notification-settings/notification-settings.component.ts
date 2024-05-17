import {Component, NgZone, OnInit} from '@angular/core';
import {AppService} from "@services/app.service";
import {ProfileSettingsApiService} from "@api/profile-settings-api.service";
import {INotificationSettings} from "@interfaces/notification-settings";
import {NotificationSettingsService} from "@services/notification-settings.service";

@Component({
  selector: 'worklenz-notification-settings',
  templateUrl: './notification-settings.component.html',
  styleUrls: ['./notification-settings.component.scss']
})
export class NotificationSettingsComponent implements OnInit {
  loading = false;
  updating = false;

  model: INotificationSettings = {};

  constructor(
    private app: AppService,
    private api: ProfileSettingsApiService,
    private settingsService: NotificationSettingsService,
    private ngZone: NgZone
  ) {
    this.app.setTitle("Notification Settings");
  }

  ngOnInit() {
    void this.get();
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.getNotificationSettings();
      if (res.done) {
        this.model = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }
  }

  async update() {
    try {
      this.updating = true;
      const res = await this.api.updateNotificationSettings(this.model);
      if (res.done) {
        this.model = res.body;
        this.settingsService.settings = res.body;
      }
      this.updating = false;
    } catch (e) {
      this.updating = false;
    }
  }

  updateSettings() {
    if (this.updating) return;
    void this.update();
  }

  requestPermissions() {
    if (this.model.popup_notifications_enabled && Notification.permission === "default") {
      this.askNotificationPermission();
    }
  }

  askNotificationPermission() {
    this.ngZone.runOutsideAngular(() => {
      // Let's check if the browser supports notifications
      if (!('Notification' in window)) {
        console.log("This browser does not support notifications.");
        return;
      }
      void Notification.requestPermission();
    });
  }
}
