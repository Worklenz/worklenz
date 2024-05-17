import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';

import {RptAllocationRoutingModule} from './rpt-allocation-routing.module';
import {RptAllocationComponent} from './rpt-allocation/rpt-allocation.component';
import {RptHeaderComponent} from "../../components/rpt-header/rpt-header.component";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzProgressModule} from "ng-zorro-antd/progress";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {FormsModule} from "@angular/forms";
import {NzBadgeModule} from "ng-zorro-antd/badge";

@NgModule({
  declarations: [
    RptAllocationComponent
  ],
    imports: [
        CommonModule,
        RptAllocationRoutingModule,
        RptHeaderComponent,
        NzIconModule,
        NzProgressModule,
        NzSkeletonModule,
        NzToolTipModule,
        NzTypographyModule,
        SafeStringPipe,
        NgOptimizedImage,
        NzFormModule,
        NzSpaceModule,
        NzDropDownModule,
        NzButtonModule,
        NzCheckboxModule,
        SearchByNamePipe,
        NzInputModule,
        NzEmptyModule,
        FormsModule,
        NzBadgeModule
    ]
})
export class RptAllocationModule {
}
