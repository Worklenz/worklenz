import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';

const LOGO_LIGHT =
  'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-light-mode.png';
const LOGO_DARK =
  'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-dark-mode.png';

const XMAS_LOGO_LIGHT =
  'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-xmas-light.webp';
const XMAS_LOGO_DARK =
  'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-xmas-dark.webp';

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
          style={{ height: 26, display: 'block' }}
        />
      </div>
    </Link>
  );
};

export default NavbarLogo;
