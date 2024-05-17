import {Component} from "@angular/core";
import {ActivatedRoute, NavigationEnd, RouteConfigLoadEnd, RouteConfigLoadStart, Router} from "@angular/router";

import {AppService} from "@services/app.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: "worklenz-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent {
  title = "worklenz";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private app: AppService,
    private auth: AuthService
  ) {
    this.router.events.subscribe(async event => {
      if (event instanceof NavigationEnd) {
        const authorized = await this.auth.authorize();
        if (!authorized)
          await this.handleSessionExpiry(event);
      }

      // Listening for lazy loading modules load end
      if (event instanceof RouteConfigLoadStart) {
        if (event.route.path)
          this.app.setLoadingPath(event.route.path);
      } else if (event instanceof RouteConfigLoadEnd) {
        this.app.setLoadingPath(null);
      }
    });
  }

  private async handleSessionExpiry(event: NavigationEnd) {
    const isAuthRoute = event.url.includes('/auth');
    const isSessionExpired = event.url.includes('/session-expired');
    if (!isAuthRoute && !isSessionExpired)
      await this.router.navigate(['/session-expired'])
  }
}
