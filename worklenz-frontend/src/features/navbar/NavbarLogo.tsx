import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';

import { LOGO_LIGHT, LOGO_DARK, XMAS_LOGO_LIGHT, XMAS_LOGO_DARK } from '@/shared/constants';

const NavbarLogo = () => {
  const { t } = useTranslation('navbar');
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);

  const isChristmasSeason = useMemo(() => {
    const now = new Date();
    return now.getMonth() === 11; // December
  }, []);

  return (
    <Link to={'/worklenz/home'}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 44 }}>
        <img
          src={
            themeMode === 'dark'
              ? isChristmasSeason
                ? XMAS_LOGO_DARK
                : LOGO_DARK
              : isChristmasSeason
                ? XMAS_LOGO_LIGHT
                : LOGO_LIGHT
          }
          alt={t('logoAlt')}
          style={{ height: isChristmasSeason ? 36 : 26, display: 'block', marginBottom: isChristmasSeason ? 12 : 0 }}
        />
      </div>
    </Link>
  );
};

export default NavbarLogo;
