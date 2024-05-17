import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import {AccountSetupRoutingModule} from './account-setup-routing.module';
import {AccountSetupComponent} from './account-setup/account-setup.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzStepsModule} from "ng-zorro-antd/steps";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzSpaceModule} from 'ng-zorro-antd/space';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {NzTypographyModule} from 'ng-zorro-antd/typography';
import {NzDividerModule} from 'ng-zorro-antd/divider';
import {NzListModule} from "ng-zorro-antd/list";
import {TeamsListComponent} from './teams-list/teams-list.component';
import {NzRadioModule} from "ng-zorro-antd/radio";
import {ProjectTemplateImportDrawerComponent} from "@admin/components/project-template-import-drawer/project-template-import-drawer.component";


@NgModule({
  declarations: [
    AccountSetupComponent,
    TeamsListComponent
  ],
    imports: [
        CommonModule,
        FormsModule,
        AccountSetupRoutingModule,
        ReactiveFormsModule,
        NzInputModule,
        NzFormModule,
        NzButtonModule,
        NzSelectModule,
        NzStepsModule,
        NzSkeletonModule,
        NzSpaceModule,
        NzIconModule,
        NzTypographyModule,
        NzDividerModule,
        NzListModule,
        NgOptimizedImage,
        NzRadioModule,
        ProjectTemplateImportDrawerComponent
    ]
})
export class AccountSetupModule {
}
