import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {RptOverviewRoutingModule} from './rpt-overview-routing.module';
import {RptOverviewComponent} from "./rpt-overview/rpt-overview.component";
import {RptHeaderComponent} from "../../components/rpt-header/rpt-header.component";
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {RptOverviewCardsComponent} from './rpt-overview/rpt-overview-cards/rpt-overview-cards.component';
import {NzTableModule} from "ng-zorro-antd/table";
import {AvatarsComponent} from "@admin/components/avatars/avatars.component";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {BindNaPipe} from "@pipes/bind-na.pipe";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzInputModule} from "ng-zorro-antd/input";
import {FormsModule} from "@angular/forms";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzGridModule} from "ng-zorro-antd/grid";
import {NzBreadCrumbModule} from "ng-zorro-antd/breadcrumb";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzProgressModule} from "ng-zorro-antd/progress";
import {NzCollapseModule} from "ng-zorro-antd/collapse";
import {NzSelectModule} from "ng-zorro-antd/select";
import {ReportingModule} from "../../reporting.module";
import {RptTeamDrawerModule} from "../../drawers/rpt-team-drawer/rpt-team-drawer.module";
import {RptProjectDrawerModule} from "../../drawers/rpt-project-drawer/rpt-project-drawer.module";
import {RptMemberDrawerModule} from "../../drawers/rpt-member-drawer/rpt-member-drawer.module";
import {RptTasksDrawerModule} from "../../drawers/rpt-tasks-drawer/rpt-tasks-drawer.module";
import {RptTaskViewDrawerModule} from "../../drawers/rpt-task-view-drawer/rpt-task-view-drawer.module";
import {NzTagModule} from "ng-zorro-antd/tag";

@NgModule({
  declarations: [
    RptOverviewComponent,
    RptOverviewCardsComponent
  ],
    imports: [
        CommonModule,
        RptOverviewRoutingModule,
        RptHeaderComponent,
        NzLayoutModule,
        NzCardModule,
        NzAvatarModule,
        NzIconModule,
        NzTypographyModule,
        NzTableModule,
        AvatarsComponent,
        NzDrawerModule,
        NzSpaceModule,
        NzButtonModule,
        NzTabsModule,
        SafeStringPipe,
        BindNaPipe,
        NzSkeletonModule,
        NzInputModule,
        FormsModule,
        SearchByNamePipe,
        NzGridModule,
        NzBreadCrumbModule,
        NzBadgeModule,
        NzProgressModule,
        NzCollapseModule,
        NzSelectModule,
        ReportingModule,
        RptTeamDrawerModule,
        RptProjectDrawerModule,
        RptMemberDrawerModule,
        RptTasksDrawerModule,
        RptTaskViewDrawerModule,
        NzTagModule
    ]
})
export class RptOverviewModule {
}
