/**
 * Service for managing invitation redirect flow
 * Handles storing and retrieving invitation context when users need to login
 */

const STORAGE_KEYS = {
  PENDING_INVITATION_TOKEN: 'worklenz_pending_invitation_token',
  PENDING_INVITATION_TYPE: 'worklenz_pending_invitation_type',
  PENDING_INVITATION_URL: 'worklenz_pending_invitation_url',
} as const;

export type InvitationType = 'team' | 'project';

interface PendingInvitation {
  token: string;
  type: InvitationType;
  url: string;
}

class InvitationRedirectService {
  /**
   * Store invitation context before redirect to login
   */
  storePendingInvitation(token: string, type: InvitationType, url: string): void {
    try {
      sessionStorage.setItem(STORAGE_KEYS.PENDING_INVITATION_TOKEN, token);
      sessionStorage.setItem(STORAGE_KEYS.PENDING_INVITATION_TYPE, type);
      sessionStorage.setItem(STORAGE_KEYS.PENDING_INVITATION_URL, url);
      console.log(`[InvitationRedirect] Stored pending ${type} invitation:`, token);
    } catch (error) {
      console.error('[InvitationRedirect] Failed to store invitation context:', error);
    }
  }

  /**
   * Retrieve stored invitation context
   */
  getPendingInvitation(): PendingInvitation | null {
    try {
      const token = sessionStorage.getItem(STORAGE_KEYS.PENDING_INVITATION_TOKEN);
      const type = sessionStorage.getItem(STORAGE_KEYS.PENDING_INVITATION_TYPE) as InvitationType;
      const url = sessionStorage.getItem(STORAGE_KEYS.PENDING_INVITATION_URL);

      if (token && type && url) {
        console.log(`[InvitationRedirect] Retrieved pending ${type} invitation:`, token);
        return { token, type, url };
      }

      return null;
    } catch (error) {
      console.error('[InvitationRedirect] Failed to retrieve invitation context:', error);
      return null;
    }
  }

  /**
   * Check if there's a pending invitation
   */
  hasPendingInvitation(): boolean {
    return !!this.getPendingInvitation();
  }

  /**
   * Clear stored invitation context
   */
  clearPendingInvitation(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.PENDING_INVITATION_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.PENDING_INVITATION_TYPE);
      sessionStorage.removeItem(STORAGE_KEYS.PENDING_INVITATION_URL);
      console.log('[InvitationRedirect] Cleared pending invitation');
    } catch (error) {
      console.error('[InvitationRedirect] Failed to clear invitation context:', error);
    }
  }

  /**
   * Get the redirect URL for a pending invitation
   */
  getPendingInvitationUrl(): string | null {
    const invitation = this.getPendingInvitation();
    return invitation ? invitation.url : null;
  }

  /**
   * Build invitation URL from token and type
   */
  buildInvitationUrl(token: string, type: InvitationType): string {
    return `/invite/${type}/${token}`;
  }
}

// Export singleton instance
export const invitationRedirectService = new InvitationRedirectService();
