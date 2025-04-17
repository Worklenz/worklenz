import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import logo from '@/assets/images/logo.png';
import logoDark from '@/assets/images/logo-dark-mode.png';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';

const NavbarLogo = () => {
  const { t } = useTranslation('navbar');
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);

  return (
    <Link to={'/worklenz/home'}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={themeMode === 'dark' ? logoDark : logo}
          alt={t('logoAlt')}
          style={{ width: '100%', maxWidth: 140 }}
        />
        <span
          style={{
            position: 'absolute',
            top: -1,
            right: 0,
            backgroundColor: '#ff5722',
            color: 'white',
            fontSize: '7px',
            padding: '0px 3px',
            borderRadius: '3px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            lineHeight: '1.8',
          }}
        >
          Beta
        </span>
      </div>
    </Link>
  );
};

export default NavbarLogo;
