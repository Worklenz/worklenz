import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeMembersComponent } from './time-members/time-members.component';
import {RptTimeMembersRoutingModule} from "./rpt-time-members-routing.module";
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
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {NzBadgeModule} from "ng-zorro-antd/badge";

@NgModule({
  declarations: [
    TimeMembersComponent
  ],
    imports: [
        CommonModule,
        RptTimeMembersRoutingModule,
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
        NzEmptyModule,
        NzBadgeModule,
    ]
})
export class RptTimeMembersModule { }
