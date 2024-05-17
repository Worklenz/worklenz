import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptTeamDrawerComponent} from "./rpt-team-drawer.component";
import {RptTeamDrawerMembersComponent} from "./rpt-team-drawer-members/rpt-team-drawer-members.component";
import {RptTeamDrawerProjectsComponent} from "./rpt-team-drawer-projects/rpt-team-drawer-projects.component";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzTableModule} from "ng-zorro-antd/table";
import {BindNaPipe} from "@pipes/bind-na.pipe";
import {NzInputModule} from "ng-zorro-antd/input";
import {FormsModule} from "@angular/forms";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {RptProjectsListModule} from "../common/rpt-projects-list/rpt-projects-list.module";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzMenuModule} from "ng-zorro-antd/menu";
import { RptTeamOverviewComponent } from './rpt-team-overview/rpt-team-overview.component';
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzGridModule} from "ng-zorro-antd/grid";
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {NgChartsModule} from "ng2-charts";

@NgModule({
  declarations: [
    RptTeamDrawerComponent,
    RptTeamDrawerProjectsComponent,
    RptTeamDrawerMembersComponent,
    RptTeamOverviewComponent
  ],
    imports: [
        CommonModule,
        NzDrawerModule,
        NzSpaceModule,
        NzButtonModule,
        NzIconModule,
        NzTabsModule,
        NzSkeletonModule,
        NzTableModule,
        BindNaPipe,
        NzInputModule,
        FormsModule,
        SearchByNamePipe,
        SafeStringPipe,
        NzDropDownModule,
        NzMenuModule,
        RptProjectsListModule,
        NzBadgeModule,
        NzCardModule,
        NzGridModule,
        EllipsisPipe,
        NgChartsModule
    ],
  exports: [
    RptTeamDrawerComponent
  ]
})
export class RptTeamDrawerModule {
}
