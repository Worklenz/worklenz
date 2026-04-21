import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';

import { LOGO_LIGHT, LOGO_DARK, XMAS_LOGO_LIGHT, XMAS_LOGO_DARK } from '@/shared/constants';

const NavbarLogo = () => {
  const cachedLogo = useMemo(() => localStorage.getItem('organizationLogo'), []);
  const { t } = useTranslation('navbar');
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
  const organization = useSelector((state: RootState) => state.adminCenterReducer.organization);

  const isChristmasSeason = useMemo(() => {
    const now = new Date();
    return now.getMonth() === 11; // December
  }, []);

const logoSrc = useMemo(() => {
  // If API logo is available, use it and save to localStorage
  if (organization?.logo_url) {
    localStorage.setItem('organizationLogo', organization.logo_url);
    return organization.logo_url;
  }
  // Use cached logo if API logo not loaded
  if (cachedLogo) return cachedLogo;

  // Fallback to default Worklenz logo (with Xmas variants)
  return themeMode === 'dark'
    ? isChristmasSeason
      ? XMAS_LOGO_DARK
      : LOGO_DARK
    : isChristmasSeason
      ? XMAS_LOGO_LIGHT
      : LOGO_LIGHT;
}, [organization?.logo_url, cachedLogo, themeMode, isChristmasSeason]);

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
