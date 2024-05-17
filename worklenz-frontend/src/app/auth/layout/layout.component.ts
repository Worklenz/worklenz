import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";

import {AuthService} from "@services/auth.service";
import {AppService} from "@services/app.service";

@Component({
  selector: "worklenz-layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"]
})
export class LayoutComponent implements OnInit {

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly app: AppService
  ) {
    const error = this.route.snapshot.queryParamMap.get("error");
    if (error) {
      this.displayError(error);
      this.removeErrorQueryParam();
    }
  }

  async ngOnInit() {
    if (this.auth.isAuthenticated())
      await this.router.navigate(["/worklenz"]);
  }

  private displayError(error: string) {
    this.app.notify('Authentication failed!', error, false);
  }

  private removeErrorQueryParam() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {}
    });
  }
}
