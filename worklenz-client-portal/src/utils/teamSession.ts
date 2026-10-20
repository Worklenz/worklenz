import { clientPortalApi } from '@/store/api';
import { setTokenWithExpiry, teamSwitched } from '@/store/slices/authSlice';
import { setOrgBranding } from '@/store/slices/uiSlice';
import { clientPortalAPI } from '@/services/api';
import type { useAppDispatch } from '@/hooks/useAppDispatch';

export interface TeamSession {
  token: string;
  expiresAt: string;
  clientId: string;
  organizationId: string;
}

/**
 * Makes the session act in another portal without reloading: every request carries the new token, the
 * new portal's branding is applied and the API cache is emptied so everything is read again for it.
 * The branding is read before anything else changes, so the top bar and rail go straight from the old
 * portal's colour to the new one, with no default-coloured frame in between.
 * Used when switching portals and when joining one through an invitation link.
 */
export const applyTeamSession = async (
  dispatch: ReturnType<typeof useAppDispatch>,
  session: TeamSession
): Promise<void> => {
  clientPortalAPI.setToken(session.token);
  dispatch(setTokenWithExpiry(session));

  let primaryColor: string | null = null;
  let portalTitle: string | null = null;
  try {
    const request = dispatch(clientPortalApi.endpoints.getOrganizationSettings.initiate(undefined, { forceRefetch: true }));
    try {
      const settings = (await request.unwrap()).body;
      primaryColor = settings?.primary_color || null;
      portalTitle = settings?.portal_title || null;
    } finally {
      request.unsubscribe();
    }
  } catch {
    // Without the settings the default branding applies until the layout reads them itself.
  }

  dispatch(setOrgBranding({ primaryColor, portalTitle }));
  dispatch(teamSwitched(session.organizationId));
  dispatch(clientPortalApi.util.resetApiState());
};
