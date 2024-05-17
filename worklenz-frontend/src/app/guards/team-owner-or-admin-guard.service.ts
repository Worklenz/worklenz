import {inject, Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';
import {AuthService} from '@services/auth.service';

@Injectable({
  providedIn: 'root'
})
class TeamOwnerOrAdminGuardService {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {
  }

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const isProjects = _route.routeConfig?.path === "projects";
    const canAccess = !!this.auth.getCurrentSession()?.owner || !!this.auth.getCurrentSession()?.is_admin;
    if (!canAccess && !isProjects)
      return this.router.navigate(['/worklenz']);
    return true;
  }

}

export const TeamOwnerOrAdminGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  return <boolean>inject(TeamOwnerOrAdminGuardService).canActivate(next, state);
}
