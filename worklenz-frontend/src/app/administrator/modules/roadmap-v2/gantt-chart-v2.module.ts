import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {GanttChartV2RoutingModule} from './gantt-chart-v2-routing.module';
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzGridModule} from "ng-zorro-antd/grid";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzIconModule} from "ng-zorro-antd/icon";
import {TaskViewModule} from "@admin/components/task-view/task-view.module";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {RxFor} from "@rx-angular/template/for";
import {ProjectRoadmapV2CustomComponent} from "./project-roadmap-v2-custom/project-roadmap-v2-custom.component";
import {RMTaskNameComponent} from './project-roadmap-v2-custom/components/task-name/task-name.component';
import {RMStartDateComponent} from './project-roadmap-v2-custom/components/start-date/start-date.component';
import {RMEndDateComponent} from './project-roadmap-v2-custom/components/end-date/end-date.component';
import {DragAndMoveDirective} from './project-roadmap-v2-custom/directives/drag-move.directive';
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {DateFormatterPipe} from "@pipes/date-formatter.pipe";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {TaskListV2Module} from "../task-list-v2/task-list-v2.module";
import {TaskBarComponent} from './project-roadmap-v2-custom/components/task-bar/task-bar.component';
import {AddTaskInputComponent} from './project-roadmap-v2-custom/components/add-task-input/add-task-input.component';
import {FiltersComponent} from './project-roadmap-v2-custom/components/filters/filters.component';
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import { AddTaskRowComponent } from './project-roadmap-v2-custom/components/add-task-row/add-task-row.component';
import {ScrollingModule} from '@angular/cdk/scrolling';

@NgModule({
  declarations: [
    ProjectRoadmapV2CustomComponent,
    RMTaskNameComponent,
    RMStartDateComponent,
    RMEndDateComponent,
    DragAndMoveDirective,
    TaskBarComponent,
    AddTaskInputComponent,
    FiltersComponent,
    AddTaskRowComponent
  ],
  imports: [
    CommonModule,
    GanttChartV2RoutingModule,
    NzCheckboxModule,
    NzGridModule,
    NzTagModule,
    NzIconModule,
    TaskViewModule,
    NzTypographyModule,
    NzAvatarModule,
    FirstCharUpperPipe,
    NzToolTipModule,
    NzSkeletonModule,
    RxFor,
    NzButtonModule,
    NzInputModule,
    NzWaveModule,
    ReactiveFormsModule,
    FormsModule,
    DateFormatterPipe,
    NzDatePickerModule,
    TaskListV2Module,
    EllipsisPipe,
    NzDropDownModule,
    NzMenuModule,
    CdkVirtualScrollViewport,
    CdkVirtualForOf,
    CdkFixedSizeVirtualScroll,
    ScrollingModule
  ],
  exports: [
    ProjectRoadmapV2CustomComponent
  ],
})
export class GanttChartV2Module {
}
