import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {RptMembersRoutingModule} from './rpt-members-routing.module';
import {RptMembersComponent} from './rpt-members/rpt-members.component';
import {RptHeaderComponent} from "../../components/rpt-header/rpt-header.component";
import {NaComponent} from "@admin/components/na/na.component";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzTableModule} from "ng-zorro-antd/table";
import {NzTagModule} from "ng-zorro-antd/tag";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {RptMemberDrawerModule} from "../../drawers/rpt-member-drawer/rpt-member-drawer.module";
import {RptProjectDrawerModule} from "../../drawers/rpt-project-drawer/rpt-project-drawer.module";
import {RptTaskViewDrawerModule} from "../../drawers/rpt-task-view-drawer/rpt-task-view-drawer.module";
import {RptTasksDrawerModule} from "../../drawers/rpt-tasks-drawer/rpt-tasks-drawer.module";
import {RptTeamDrawerModule} from "../../drawers/rpt-team-drawer/rpt-team-drawer.module";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {TasksProgressBarComponent} from "@admin/components/tasks-progress-bar/tasks-progress-bar.component";
import {RptProjectsModule} from "../rpt-projects/rpt-projects.module";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {RptSingleMemberDrawerModule} from "../../drawers/rpt-single-member-drawer/rpt-single-member-drawer.module";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {ReportingModule} from "../../reporting.module";


@NgModule({
  declarations: [
    RptMembersComponent
  ],
    imports: [
        CommonModule,
        RptMembersRoutingModule,
        RptHeaderComponent,
        NaComponent,
        NzBadgeModule,
        NzCardModule,
        NzIconModule,
        NzInputModule,
        NzLayoutModule,
        NzTableModule,
        NzTagModule,
        ReactiveFormsModule,
        RptMemberDrawerModule,
        RptProjectDrawerModule,
        RptTaskViewDrawerModule,
        RptTasksDrawerModule,
        RptTeamDrawerModule,
        SearchByNamePipe,
        TasksProgressBarComponent,
        FormsModule,
        RptProjectsModule,
        NzAvatarModule,
        FirstCharUpperPipe,
        RptSingleMemberDrawerModule,
        NzSpaceModule,
        NzCheckboxModule,
        NzDropDownModule,
        NzMenuModule,
        NzToolTipModule,
        NzButtonModule,
        NzTypographyModule,
        ReportingModule
    ]
})
export class RptMembersModule {
}
