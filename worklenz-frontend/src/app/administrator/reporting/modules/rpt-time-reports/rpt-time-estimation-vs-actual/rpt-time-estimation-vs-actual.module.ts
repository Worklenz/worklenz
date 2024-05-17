import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptTimeEstimationVsActualRoutingModule} from "./rpt-time-estimation-vs-actual-routing.module";
import {
  TimeEstimationVsActualProjectsComponent
} from './time-estimation-vs-actual-projects/time-estimation-vs-actual-projects.component';
import {NgChartsModule} from "ng2-charts";
import {RptHeaderComponent} from "../../../components/rpt-header/rpt-header.component";
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzInputModule} from "ng-zorro-antd/input";
import {FormsModule} from "@angular/forms";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {NzSegmentedModule} from "ng-zorro-antd/segmented";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzBadgeModule} from "ng-zorro-antd/badge";


@NgModule({
  declarations: [
    TimeEstimationVsActualProjectsComponent
  ],
    imports: [
        CommonModule,
        RptTimeEstimationVsActualRoutingModule,
        NgChartsModule,
        RptHeaderComponent,
        NzLayoutModule,
        NzCardModule,
        NzSpaceModule,
        NzInputModule,
        FormsModule,
        NzDropDownModule,
        NzButtonModule,
        NzCheckboxModule,
        SearchByNamePipe,
        NzIconModule,
        NzTypographyModule,
        NzEmptyModule,
        NzSegmentedModule,
        NzToolTipModule,
        NzBadgeModule,
    ]
})
export class RptTimeEstimationVsActualModule {
}
