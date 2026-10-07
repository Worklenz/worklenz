import { Outlet, useLocation } from 'react-router-dom';

import { Layout } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { LOGO_LIGHT, LOGO_DARK, XMAS_LOGO_LIGHT, XMAS_LOGO_DARK } from '@/shared/constants';

// These pages already show their own centered WorklenzLogoLoader while they
// redirect, so the layout's fixed top-left logo would double up with it.
const ROUTES_WITHOUT_FIXED_LOGO = ['/auth/authenticating', '/auth/logging-out'];

const AuthLayout = () => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const location = useLocation();
  // AuthLayout stays mounted across /auth/* route changes, so this must be
  // recomputed per render rather than memoized once per mount — otherwise the
  // Christmas logo can go stale for a session that started before Dec 1.
  const isChristmasSeason = new Date().getMonth() === 11;

  const logoSrc =
    themeMode === 'dark'
      ? isChristmasSeason
        ? XMAS_LOGO_DARK
        : LOGO_DARK
      : isChristmasSeason
        ? XMAS_LOGO_LIGHT
        : LOGO_LIGHT;

  const showFixedLogo = !ROUTES_WITHOUT_FIXED_LOGO.includes(location.pathname);

  return (
    <Layout
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '56px 20px',
        position: 'relative',
      }}
    >
      {showFixedLogo && (
        <img
          src={logoSrc}
          alt="Worklenz"
          style={{
            position: 'fixed',
            top: 24,
            left: 28,
            height: 28,
            width: 'auto',
            zIndex: 2,
          }}
        />
      )}
      <div style={{ maxWidth: 400, width: '100%' }}>
        <Outlet />
      </div>
    </Layout>
  );
};

export default AuthLayout;
