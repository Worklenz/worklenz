import {inject, Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';

import {AuthService} from "@services/auth.service";

@Injectable({
  providedIn: 'root'
})
class AuthGuardService {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {
  }

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const authenticated = this.auth.isAuthenticated();
    if (!authenticated) {
      return this.router.navigate(["/auth/login"]);
    }
    return authenticated;
  }
}

export const AuthGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  return <boolean>inject(AuthGuardService).canActivate(next, state);
}
