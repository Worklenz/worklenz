import { ILocalSession } from '@/types/auth/local-session.types';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { ROLE_NAMES } from '@/types/roles/role.types';
import logger from '@/utils/errorLogger';
import { deleteSession, getUserSession, hasSession, setSession } from '@/utils/session-helper';
import { NavigateFunction } from 'react-router-dom';

class AuthService {
  private readonly navigate: NavigateFunction;

  constructor(navigate: NavigateFunction) {
    this.navigate = navigate;
  }

  // Computed property for user role
  get role(): string {
    const user = this.getCurrentSession();
    if (!user) return 'Unknown';
    return getSessionRoleName(user);
  }

  // Session management methods
  public isAuthenticated(): boolean {
    return !!this.getCurrentSession();
  }

  public isExpired(): boolean {
    return !!this.getCurrentSession()?.is_expired;
  }

  public setCurrentSession(user: ILocalSession): void {
    setSession(user);
  }

  public getCurrentSession(): ILocalSession | null {
    return getUserSession();
  }

  public isOwnerOrAdmin(): boolean {
    const currentRole = getSessionRoleName(this.getCurrentSession());
    return currentRole === ROLE_NAMES.OWNER || currentRole === ROLE_NAMES.ADMIN;
  }

  // Sign out methods
  public async signOut(): Promise<void> {
    try {
      if (hasSession()) {
        deleteSession();
      }
    } catch (e) {
      logger.error('Error signing out', e);
    }
  }

  public hasCompletedSetup(): boolean {
    const user = this.getCurrentSession();
    return !!user?.setup_completed;
  }

  private onSignOutConfirm(): void {
    void this.signOut();
    window.location.href = '/secure/logout';
  }
}

// Hook for using AuthService in components
export const createAuthService = (navigate: NavigateFunction): AuthService => {
  return new AuthService(navigate);
};
