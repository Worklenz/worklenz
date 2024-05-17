import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {CategoriesRoutingModule} from './categories-routing.module';
import {CategoriesComponent} from "./categories/categories.component";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzTableModule} from "ng-zorro-antd/table";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzFormModule} from "ng-zorro-antd/form";
import {ToggleMenuButtonComponent} from "@admin/components/toggle-menu-button/toggle-menu-button.component";
import {FormsModule} from "@angular/forms";
import {NzInputModule} from "ng-zorro-antd/input";

@NgModule({
  declarations: [CategoriesComponent],
  imports: [
    CommonModule,
    CategoriesRoutingModule,
    NzDropDownModule,
    NzCardModule,
    NzSkeletonModule,
    NzTableModule,
    NzTagModule,
    NzToolTipModule,
    NzSpaceModule,
    NzButtonModule,
    NzIconModule,
    NzFormModule,
    ToggleMenuButtonComponent,
    FormsModule,
    NzInputModule
  ]
})
export class CategoriesModule {
}
