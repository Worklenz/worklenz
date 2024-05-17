import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {RptProjectsRoutingModule} from './rpt-projects-routing.module';
import {RptProjectsComponent} from './rpt-projects/rpt-projects.component';
import {RptHeaderComponent} from "../../components/rpt-header/rpt-header.component";
import {AvatarsComponent} from "@admin/components/avatars/avatars.component";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzTableModule} from "ng-zorro-antd/table";
import {BindNaPipe} from "@pipes/bind-na.pipe";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzIconModule} from "ng-zorro-antd/icon";
import {RptProjectDrawerModule} from "../../drawers/rpt-project-drawer/rpt-project-drawer.module";
import {RptMemberDrawerModule} from "../../drawers/rpt-member-drawer/rpt-member-drawer.module";
import {RptTaskViewDrawerModule} from "../../drawers/rpt-task-view-drawer/rpt-task-view-drawer.module";
import {RptTasksDrawerModule} from "../../drawers/rpt-tasks-drawer/rpt-tasks-drawer.module";
import {RptTeamDrawerModule} from "../../drawers/rpt-team-drawer/rpt-team-drawer.module";
import {NzInputModule} from "ng-zorro-antd/input";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NaComponent} from "@admin/components/na/na.component";
import {TasksProgressBarComponent} from "@admin/components/tasks-progress-bar/tasks-progress-bar.component";
import {
  RptProjectsEstimatedVsActualComponent
} from './rpt-projects/rpt-projects-estimated-vs-actual/rpt-projects-estimated-vs-actual.component';
import {NgChartsModule} from "ng2-charts";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {ReportingModule} from "../../reporting.module";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {ProjectUpdatesDrawerComponent} from "@admin/components/project-updates-drawer/project-updates-drawer.component";
import {
  ProjectCategoriesAutocompleteComponent
} from "@admin/components/project-categories-autocomplete/project-categories-autocomplete.component";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {NzAvatarModule} from "ng-zorro-antd/avatar";

@NgModule({
  declarations: [
    RptProjectsComponent,
    RptProjectsEstimatedVsActualComponent
  ],
  exports: [
    RptProjectsEstimatedVsActualComponent
  ],
    imports: [
        CommonModule,
        RptProjectsRoutingModule,
        RptHeaderComponent,
        AvatarsComponent,
        NzCardModule,
        NzLayoutModule,
        NzTableModule,
        BindNaPipe,
        NzTypographyModule,
        NzTagModule,
        NzIconModule,
        RptProjectDrawerModule,
        RptMemberDrawerModule,
        RptTaskViewDrawerModule,
        RptTasksDrawerModule,
        RptTeamDrawerModule,
        NzInputModule,
        ReactiveFormsModule,
        FormsModule,
        SearchByNamePipe,
        NzBadgeModule,
        NaComponent,
        TasksProgressBarComponent,
        NgChartsModule,
        NzToolTipModule,
        ReportingModule,
        SafeStringPipe,
        NzSpaceModule,
        EllipsisPipe,
        ProjectUpdatesDrawerComponent,
        ProjectCategoriesAutocompleteComponent,
        NzButtonModule,
        NzCheckboxModule,
        NzDropDownModule,
        NzMenuModule,
        NzWaveModule,
        FirstCharUpperPipe,
        NzAvatarModule
    ]
})
export class RptProjectsModule {
}
