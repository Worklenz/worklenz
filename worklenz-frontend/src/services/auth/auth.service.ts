import { ILocalSession } from '@/types/auth/local-session.types';
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
    if (user.owner) return 'Owner';
    if (user.is_admin) return 'Admin';
    return 'Member';
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
    return !!(this.getCurrentSession()?.owner || this.getCurrentSession()?.is_admin);
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
