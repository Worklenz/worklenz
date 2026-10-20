import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useGetOrganizationsQuery, useSwitchOrganizationMutation } from '@/store/api';
import { applyTeamSession } from '@/utils/teamSession';
import { getPathAfterTeamSwitch } from '@/utils/teamSwitchNavigation';
import type { ClientOrganization } from '@/types';

export interface TeamSwitch {
  teams: ClientOrganization[];
  currentTeam: ClientOrganization | undefined;
  /** More than one team: only then is there anything to switch. */
  canSwitch: boolean;
  isLoading: boolean;
  isSwitching: boolean;
  /** Resolves true when the session now acts in the team. */
  switchTo: (teamId: string) => Promise<boolean>;
}

const NO_TEAMS: ClientOrganization[] = [];

/**
 * The teams (workspaces) this client login can act in, and switching between them. The team lives in
 * the session token, so a switch swaps the token and then re-reads everything for the new team without
 * reloading the browser: the API cache is cleared, the routed content remounts (see `teamEpoch`), and
 * the app moves off any page that belonged to one item of the old team.
 */
export const useTeamSwitch = (): TeamSwitch => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const currentOrganizationId = useAppSelector(state => state.auth.currentOrganizationId);
  // Re-read on every mount: a team added since the list was cached must show up without a sign-in.
  const { data, isLoading } = useGetOrganizationsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [switchOrganization] = useSwitchOrganizationMutation();
  const [isSwitching, setIsSwitching] = useState(false);

  // Clearing the API cache on a switch empties `data` until the list is fetched again. Keep the last
  // known teams meanwhile so the switcher does not blink out of the top bar.
  const lastTeams = useRef<ClientOrganization[]>(NO_TEAMS);
  if (data?.body?.organizations) lastTeams.current = data.body.organizations;
  const teams = lastTeams.current;

  // `currentOrganizationId` follows a switch immediately; the server's `isCurrent` covers a fresh load.
  const currentTeam =
    teams.find(team => team.teamId === currentOrganizationId) ?? teams.find(team => team.isCurrent);

  const switchTo = useCallback(
    async (teamId: string): Promise<boolean> => {
      if (isSwitching || teamId === currentTeam?.teamId) return false;
      setIsSwitching(true);
      try {
        const response = await switchOrganization(teamId).unwrap();
        if (!response.done) throw new Error(response.message ?? undefined);

        await applyTeamSession(dispatch, response.body);

        const target = getPathAfterTeamSwitch(location.pathname);
        if (target !== location.pathname) navigate(target, { replace: true });

        const switchedTeam = teams.find(team => team.teamId === teamId);
        const name = switchedTeam
          ? switchedTeam.portalTitle?.trim() || t('app.defaultPortalName', { defaultValue: 'Worklenz Client Portal' })
          : undefined;
        if (name) message.success(t('organizations.switched_to', { defaultValue: 'Switched to {{name}}', name }));
        return true;
      } catch {
        // A failed switch leaves the session in the current team.
        message.error(t('organizations.switch_error', { defaultValue: 'Failed to switch portal' }));
        return false;
      } finally {
        setIsSwitching(false);
      }
    },
    [currentTeam?.teamId, dispatch, isSwitching, location.pathname, navigate, switchOrganization, t, teams]
  );

  return { teams, currentTeam, canSwitch: teams.length > 1, isLoading, isSwitching, switchTo };
};
