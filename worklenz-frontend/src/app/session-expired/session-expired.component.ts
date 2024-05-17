import {Component} from '@angular/core';
import {Router} from "@angular/router";
import {AppService} from "@services/app.service";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzTypographyModule} from "ng-zorro-antd/typography";

@Component({
  selector: 'worklenz-session-expired',
  templateUrl: './session-expired.component.html',
  styleUrls: ['./session-expired.component.scss'],
  imports: [
    NzButtonModule,
    NzTypographyModule
  ],
  standalone: true
})
export class SessionExpiredComponent {
  loading = false;

  constructor(
    private router: Router,
    private app: AppService
  ) {
    this.app.setTitle("Please sign in again");
  }

  reload() {
    this.loading = true;
    setTimeout(() => {
      void this.router.navigate(['/auth/login']);
    }, 1000);
  }
}
