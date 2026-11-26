import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { useAuthService } from '@/hooks/useAuth';
import {
  clearOrganizationLogoCache,
  readOrganizationLogoCache,
  writeOrganizationLogoCache,
} from '@/utils/organization-logo-cache';

import { LOGO_LIGHT, LOGO_DARK, XMAS_LOGO_LIGHT, XMAS_LOGO_DARK } from '@/shared/constants';

const NavbarLogo = () => {
  const { t } = useTranslation('navbar');
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
  const organization = useSelector((state: RootState) => state.adminCenterReducer.organization);
  const loadingOrganization = useSelector(
    (state: RootState) => state.adminCenterReducer.loadingOrganization
  );
  const teamsList = useSelector((state: RootState) => state.teamReducer.teamsList);
  const { getCurrentSession } = useAuthService();
  const session = getCurrentSession();
  const teamId = session?.team_id;

  const isChristmasSeason = useMemo(() => {
    const now = new Date();
    return now.getMonth() === 11; // December
  }, []);

  const defaultLogo = useMemo(
    () =>
      themeMode === 'dark'
        ? isChristmasSeason
          ? XMAS_LOGO_DARK
          : LOGO_DARK
        : isChristmasSeason
          ? XMAS_LOGO_LIGHT
          : LOGO_LIGHT,
    [themeMode, isChristmasSeason]
  );

  const activeTeam = useMemo(
    () => (teamId ? teamsList.find(team => team.id === teamId) : undefined),
    [teamsList, teamId]
  );

  // Prefer the active team's logo from the teams list (available to all roles).
  // Once the active team is known, do not fall back to organization.logo_url —
  // that can still hold the previous team's logo until org details refetch.
  const liveLogoUrl =
    activeTeam !== undefined
      ? activeTeam.logo_url || null
      : organization?.logo_url || null;

  const logoSrc = useMemo(() => {
    if (liveLogoUrl) {
      writeOrganizationLogoCache(teamId, liveLogoUrl);
      return liveLogoUrl;
    }

    const hasResolvedNoLogo =
      // Active team is known and has no logo
      (activeTeam !== undefined && !activeTeam.logo_url) ||
      // Teams not loaded yet, but organization loaded and has no logo
      (activeTeam === undefined &&
        organization !== null &&
        !loadingOrganization &&
        !organization?.logo_url);

    if (hasResolvedNoLogo) {
      clearOrganizationLogoCache(teamId);
      return defaultLogo;
    }

    // Still resolving — use only the cache for the current team (never the
    // legacy unscoped key, which kept the previous team's logo after a switch).
    const cachedLogo = readOrganizationLogoCache(teamId);
    if (cachedLogo) return cachedLogo;

    return defaultLogo;
  }, [liveLogoUrl, activeTeam, organization, loadingOrganization, teamId, defaultLogo]);

  const logoHeight = useMemo(() => {
    return isChristmasSeason ? 36 : 26;
  }, [isChristmasSeason]);

  return (
    <Link to={'/worklenz/home'}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 44 }}>
        <img
          key={teamId || 'default'}
          src={logoSrc}
          alt={t('logoAlt')}
          style={{
            height: logoHeight,
            maxHeight: 44,
            maxWidth: 140,
            display: 'block',
            marginBottom: isChristmasSeason && logoSrc === defaultLogo ? 12 : 0,
            objectFit: 'contain',
          }}
          onError={e => {
            // Fallback to default logo on error
            const target = e.target as HTMLImageElement;
            target.src =
              themeMode === 'dark'
                ? isChristmasSeason
                  ? XMAS_LOGO_DARK
                  : LOGO_DARK
                : isChristmasSeason
                  ? XMAS_LOGO_LIGHT
                  : LOGO_LIGHT;
          }}
        />
      </div>
    </Link>
  );
};

export default NavbarLogo;
