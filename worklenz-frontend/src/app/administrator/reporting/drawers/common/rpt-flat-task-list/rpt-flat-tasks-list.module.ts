import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptFlatTaskListComponent} from './rpt-flat-task-list.component';
import {BindNaPipe} from "@pipes/bind-na.pipe";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzTableModule} from "ng-zorro-antd/table";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzGridModule} from "ng-zorro-antd/grid";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzTypographyModule} from "ng-zorro-antd/typography";

@NgModule({
  declarations: [
    RptFlatTaskListComponent
  ],
  exports: [
    RptFlatTaskListComponent
  ],
    imports: [
        CommonModule,
        BindNaPipe,
        NzIconModule,
        NzInputModule,
        NzSkeletonModule,
        NzTableModule,
        ReactiveFormsModule,
        SafeStringPipe,
        SearchByNamePipe,
        FormsModule,
        NzBadgeModule,
        NzTagModule,
        NzGridModule,
        NzSelectModule,
        NzTypographyModule
    ]
})
export class RptFlatTasksListModule {
}
