import {inject, Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';
import {AuthService} from "@services/auth.service";

@Injectable({
  providedIn: 'root'
})
class TeamMemberGuardService {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {
  }

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const session = this.auth.getCurrentSession();
    if (session?.is_admin || session?.owner) return true;
    const canAccess = !!session?.is_member;
    if (!canAccess)
      return this.router.navigate(['/worklenz']);
    return true;
  }

}

export const TeamMemberGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {
  return <boolean>inject(TeamMemberGuardService).canActivate(next, state);
}
