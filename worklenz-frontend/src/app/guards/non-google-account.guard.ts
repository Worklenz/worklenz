import {inject, Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';
import {AuthService} from "@services/auth.service";

@Injectable({
  providedIn: 'root'
})
class NonGoogleAccountGuardService {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {
  }

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const session = this.auth.getCurrentSession();
    if (session?.is_google)
      return this.router.navigate(['/worklenz']);
    return true;
  }
}

export const NonGoogleAccountGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  return <boolean>inject(NonGoogleAccountGuardService).canActivate(next, state);
}
