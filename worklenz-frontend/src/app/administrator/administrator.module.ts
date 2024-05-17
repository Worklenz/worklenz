import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NotificationsDrawerComponent} from "./layout/notifications-drawer/notifications-drawer.component";
import {AdministratorRoutingModule} from './administrator-routing.module';
import {LayoutComponent} from './layout/layout.component';
import {NzSpinModule} from "ng-zorro-antd/spin";
import {NzAffixModule} from "ng-zorro-antd/affix";
import {NzAlertModule} from "ng-zorro-antd/alert";
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzBreadCrumbModule} from "ng-zorro-antd/breadcrumb";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzButtonModule} from "ng-zorro-antd/button";
import {FromNowPipe} from "@pipes/from-now.pipe";
import {NzMessageServiceModule} from "ng-zorro-antd/message";
import {AlertsComponent} from './layout/alerts/alerts.component';
import {HeaderComponent} from './layout/header/header.component';
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {NzTagModule} from "ng-zorro-antd/tag";
import {
  NotificationTemplateComponent
} from './layout/notifications-drawer/notification-template/notification-template.component';
import {TagBackgroundPipe} from './layout/notifications-drawer/tag-background.pipe';
import {NzSegmentedModule} from "ng-zorro-antd/segmented";
import {NzDividerModule} from "ng-zorro-antd/divider";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import {LicensingAlertsComponent} from './layout/licensing-alerts/licensing-alerts.component';
import {NzResultModule} from "ng-zorro-antd/result";
import {NzListModule} from "ng-zorro-antd/list";
import {TeamMembersFormComponent} from "@admin/components/team-members-form/team-members-form.component";

@NgModule({
  declarations: [
    LayoutComponent,
    AlertsComponent,
    HeaderComponent,
    NotificationTemplateComponent,
    TagBackgroundPipe,
    LicensingAlertsComponent,
    NotificationsDrawerComponent,
  ],
  exports: [],
    imports: [
        CommonModule,
        AdministratorRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        NzSpinModule,
        NzAffixModule,
        NzAlertModule,
        NzLayoutModule,
        NzMenuModule,
        NzTypographyModule,
        NzToolTipModule,
        NzDropDownModule,
        NzIconModule,
        NzBadgeModule,
        NzAvatarModule,
        NzBreadCrumbModule,
        NzDrawerModule,
        NzEmptyModule,
        NzMessageServiceModule,
        NzSpaceModule,
        NzButtonModule,
        FromNowPipe,
        NgOptimizedImage,
        SafeStringPipe,
        NzTagModule,
        NzSegmentedModule,
        NzDividerModule,
        NzSkeletonModule,
        CdkVirtualScrollViewport,
        CdkVirtualForOf,
        CdkFixedSizeVirtualScroll,
        NzResultModule,
        NzListModule,
        TeamMembersFormComponent
    ]
})
export class AdministratorModule {
}
