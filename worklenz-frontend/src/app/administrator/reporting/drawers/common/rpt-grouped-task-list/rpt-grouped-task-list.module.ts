import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptGroupedTaskListComponent} from './rpt-grouped-task-list.component';
import {BindNaPipe} from "@pipes/bind-na.pipe";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzCollapseModule} from "ng-zorro-antd/collapse";
import {NzGridModule} from "ng-zorro-antd/grid";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzTableModule} from "ng-zorro-antd/table";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NaComponent} from "@admin/components/na/na.component";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzTypographyModule} from "ng-zorro-antd/typography";

@NgModule({
  declarations: [
    RptGroupedTaskListComponent
  ],
  exports: [
    RptGroupedTaskListComponent
  ],
    imports: [
        CommonModule,
        BindNaPipe,
        NzBadgeModule,
        NzCollapseModule,
        NzGridModule,
        NzIconModule,
        NzInputModule,
        NzSelectModule,
        NzSkeletonModule,
        NzTableModule,
        ReactiveFormsModule,
        SearchByNamePipe,
        FormsModule,
        NaComponent,
        NzTagModule,
        NzTypographyModule
    ]
})
export class RptGroupedTaskListModule {
}
