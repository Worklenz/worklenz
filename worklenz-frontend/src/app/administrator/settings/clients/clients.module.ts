import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {ClientsRoutingModule} from './clients-routing.module';
import {ClientsComponent} from './clients/clients.component';
import {NzPageHeaderModule} from 'ng-zorro-antd/page-header';
import {NzButtonModule} from 'ng-zorro-antd/button';
import {NzTableModule} from 'ng-zorro-antd/table';
import {NzDividerModule} from 'ng-zorro-antd/divider';
import {NzModalModule} from 'ng-zorro-antd/modal';
import {NzFormModule} from 'ng-zorro-antd/form';
import {ReactiveFormsModule} from '@angular/forms';
import {NzInputModule} from 'ng-zorro-antd/input';
import {NzPopconfirmModule} from 'ng-zorro-antd/popconfirm';
import {NzBreadCrumbModule} from 'ng-zorro-antd/breadcrumb';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {NzCardModule} from "ng-zorro-antd/card";
import {NzLayoutModule} from 'ng-zorro-antd/layout';
import {NzSpaceModule} from 'ng-zorro-antd/space';
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {ToggleMenuButtonComponent} from "../../components/toggle-menu-button/toggle-menu-button.component";


@NgModule({
  declarations: [
    ClientsComponent
  ],
  imports: [
    CommonModule,
    ClientsRoutingModule,
    NzPageHeaderModule,
    NzButtonModule,
    NzTableModule,
    NzDividerModule,
    NzModalModule,
    NzFormModule,
    ReactiveFormsModule,
    NzInputModule,
    NzPopconfirmModule,
    NzBreadCrumbModule,
    NzIconModule,
    NzCardModule,
    NzLayoutModule,
    NzSpaceModule,
    NzDrawerModule,
    NzTypographyModule,
    NzToolTipModule,
    NzSkeletonModule,
    NzSpinModule,
    ToggleMenuButtonComponent
  ]
})
export class ClientsModule {
}
