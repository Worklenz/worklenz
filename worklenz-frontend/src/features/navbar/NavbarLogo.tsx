import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';

import { LOGO_LIGHT, LOGO_DARK, XMAS_LOGO_LIGHT, XMAS_LOGO_DARK } from '@/shared/constants';

const NavbarLogo = () => {
  const { t } = useTranslation('navbar');
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
  const organization = useSelector((state: RootState) => state.adminCenterReducer.organization);
  const loadingOrganization = useSelector(
    (state: RootState) => state.adminCenterReducer.loadingOrganization
  );

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

  const logoSrc = useMemo(() => {
    // If API logo is available, save to localStorage and use it
    if (organization?.logo_url) {
      localStorage.setItem('organizationLogo', organization.logo_url);
      return organization.logo_url;
    }

    // Organization has loaded but has no logo — clear cache and use default
    if (organization !== null && !loadingOrganization) {
      localStorage.removeItem('organizationLogo');
      return defaultLogo;
    }

    // Organization not yet loaded — use cached logo to avoid flash
    const cachedLogo = localStorage.getItem('organizationLogo');
    if (cachedLogo) return cachedLogo;

    return defaultLogo;
  }, [organization, loadingOrganization, defaultLogo]);

  const logoHeight = useMemo(() => {
    // For custom logos, maintain aspect ratio but constrain to navbar height
    if (organization?.logo_url) {
      return isChristmasSeason ? 36 : 26;
    }
    return isChristmasSeason ? 36 : 26;
  }, [organization?.logo_url, isChristmasSeason]);

  return (
    <Link to={'/worklenz/home'}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 44 }}>
        <img
          src={logoSrc}
          alt={t('logoAlt')}
          style={{
            height: logoHeight,
            maxHeight: 44,
            maxWidth: 140,
            display: 'block',
            marginBottom: isChristmasSeason && !organization?.logo_url ? 12 : 0,
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
