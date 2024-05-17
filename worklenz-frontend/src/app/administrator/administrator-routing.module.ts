import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {LayoutComponent} from './layout/layout.component';
import {TeamOwnerOrAdminGuard} from '../guards/team-owner-or-admin-guard.service';
import {TeamNameGuard} from '../guards/team-name.guard';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    canActivate: [TeamNameGuard],
    children: [
      {path: '', redirectTo: 'home', pathMatch: 'full'},
      {path: 'dashboard', redirectTo: 'home', pathMatch: 'full'}, // Remove after a couple releases
      {
        path: 'home',
        loadChildren: () => import('./my-dashboard/my-dashboard.module').then(m => m.MyDashboardModule)
      },
      {
        path: 'projects',
        canActivate: [TeamOwnerOrAdminGuard],
        loadChildren: () => import('./projects/projects.module').then(m => m.ProjectsModule)
      },
      {
        path: 'settings',
        loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule)
      },
      {
        path: 'schedule',
        canActivate: [TeamOwnerOrAdminGuard],
        loadChildren: () => import('./schedule/schedule.module').then(m => m.ScheduleModule)
      },
      {
        path: 'reporting',
        canActivate: [TeamOwnerOrAdminGuard],
        loadChildren: () => import('./reporting/reporting.module').then(m => m.ReportingModule)
      }, {
        path: 'admin-center',
        canActivate: [TeamOwnerOrAdminGuard],
        loadChildren: () => import('./admin-center/admin-center.module').then(m => m.AdminCenterModule)
      }
    ]
  },
  {
    path: 'setup',
    loadChildren: () => import('./account-setup/account-setup.module').then(m => m.AccountSetupModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdministratorRoutingModule {
}
