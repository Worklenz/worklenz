import {Component} from '@angular/core';
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-admin-center-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  constructor(
    private readonly auth: AuthService
  ) {
  }

  get profile() {
    return this.auth.getCurrentSession();
  }
}
