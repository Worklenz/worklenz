import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {NotificationSettingsRoutingModule} from './notification-settings-routing.module';
import {NotificationSettingsComponent} from './notification-settings/notification-settings.component';
import {NzCardModule} from "ng-zorro-antd/card";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzDividerModule} from "ng-zorro-antd/divider";


@NgModule({
  declarations: [
    NotificationSettingsComponent
  ],
  imports: [
    CommonModule,
    NotificationSettingsRoutingModule,
    NzCardModule,
    NzSkeletonModule,
    NzCheckboxModule,
    NzTypographyModule,
    NzDividerModule
  ]
})
export class NotificationSettingsModule {
}
