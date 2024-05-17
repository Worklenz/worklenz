import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptTimeProjectsRoutingModule} from "./rpt-time-projects-routing.module";
import {TimeProjectsComponent} from './time-projects/time-projects.component';
import {FormsModule} from "@angular/forms";
import {NgChartsModule} from "ng2-charts";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {RptHeaderComponent} from "../../../components/rpt-header/rpt-header.component";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {ReportingModule} from "../../../reporting.module";

@NgModule({
  declarations: [
    TimeProjectsComponent
  ],
  imports: [
    CommonModule,
    RptTimeProjectsRoutingModule,
    FormsModule,
    NgChartsModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDropDownModule,
    NzInputModule,
    NzLayoutModule,
    NzMenuModule,
    NzSpaceModule,
    NzWaveModule,
    RptHeaderComponent,
    SearchByNamePipe,
    NzIconModule,
    NzTypographyModule,
    NzEmptyModule,
    NzBadgeModule,
    ReportingModule,
  ]
})
export class RptTimeProjectsModule {
}
