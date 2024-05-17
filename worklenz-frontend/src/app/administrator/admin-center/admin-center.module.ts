import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AdminCenterRoutingModule} from './admin-center-routing.module';
import {NzLayoutModule} from 'ng-zorro-antd/layout';
import {NzPageHeaderModule} from 'ng-zorro-antd/page-header';
import {SidebarComponent} from './sidebar/sidebar.component';
import {NzMenuModule} from 'ng-zorro-antd/menu';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {OverviewComponent} from './overview/overview.component';
import {NzCardModule} from 'ng-zorro-antd/card';
import {NzTypographyModule} from 'ng-zorro-antd/typography';
import {NzTableModule} from 'ng-zorro-antd/table';
import {UsersComponent} from './users/users.component';
import {TeamsComponent} from './teams/teams.component';
import {LayoutComponent} from './layout/layout.component';
import {NzSpaceModule} from 'ng-zorro-antd/space';
import {NzFormModule} from 'ng-zorro-antd/form';
import {NzInputModule} from 'ng-zorro-antd/input';
import {NzButtonModule} from 'ng-zorro-antd/button';
import {NzSkeletonModule} from 'ng-zorro-antd/skeleton';
import {NzAvatarModule} from 'ng-zorro-antd/avatar';
import {NzBadgeModule} from 'ng-zorro-antd/badge';
import {NzToolTipModule} from 'ng-zorro-antd/tooltip';
import {NzDropDownModule} from 'ng-zorro-antd/dropdown';
import {NzRadioModule} from 'ng-zorro-antd/radio';
import {NzDrawerModule} from 'ng-zorro-antd/drawer';
import {NzSelectModule} from 'ng-zorro-antd/select';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {AvatarsComponent} from "../components/avatars/avatars.component";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {NzModalModule} from "ng-zorro-antd/modal";
import {NzProgressModule} from "ng-zorro-antd/progress";
import {NzDividerModule} from "ng-zorro-antd/divider";
import {NzSegmentedModule} from "ng-zorro-antd/segmented";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzAutocompleteModule} from "ng-zorro-antd/auto-complete";


@NgModule({
  declarations: [
    SidebarComponent,
    OverviewComponent,
    UsersComponent,
    TeamsComponent,
    LayoutComponent
  ],
    imports: [
        CommonModule,
        AdminCenterRoutingModule,
        NzLayoutModule,
        NzPageHeaderModule,
        NzMenuModule,
        NzIconModule,
        NzCardModule,
        NzTypographyModule,
        NzTableModule,
        NzSpaceModule,
        NzFormModule,
        NzInputModule,
        NzButtonModule,
        NzSkeletonModule,
        NzBadgeModule,
        NzAvatarModule,
        NzToolTipModule,
        NzDropDownModule,
        NzRadioModule,
        NzDrawerModule,
        NzSelectModule,
        ReactiveFormsModule,
        AvatarsComponent,
        FormsModule,
        NzTabsModule,
        FirstCharUpperPipe,
        NzModalModule,
        NzProgressModule,
        NzDividerModule,
        NzSegmentedModule,
        NzPopconfirmModule,
        NzCheckboxModule,
        NzAutocompleteModule
    ]
})
export class AdminCenterModule {
}
