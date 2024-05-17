import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {NotificationSettingsComponent} from "./notification-settings/notification-settings.component";

const routes: Routes = [
  {path: "", component: NotificationSettingsComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class NotificationSettingsRoutingModule {
}
