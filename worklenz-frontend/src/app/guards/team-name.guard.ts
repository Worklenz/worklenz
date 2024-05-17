import {inject, Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';
import {AuthService} from "@services/auth.service";

@Injectable({
  providedIn: 'root'
})
class TeamNameGuardService {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {
  }

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const session = this.auth.getCurrentSession();
    if (!session?.setup_completed)
      return this.router.navigate(['/worklenz/setup']);
    return true;
  }

}

export const TeamNameGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  return <boolean>inject(TeamNameGuardService).canActivate(next, state);
}
