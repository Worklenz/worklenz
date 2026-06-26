import { Layout } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';

import Navbar from '@/features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { TrialExpirationAlert } from '@/components/TrialExpirationAlert/TrialExpirationAlert';
import UpgradePlansModal from '@/worklenz-ee/components/UpgradePlansModal';
import { ImportProgressNotifier } from '@/components/imports/ImportProgressNotifier';
import { MobileAppBanner } from '@/components/mobile-app/MobileAppBanner';

const MainLayout = memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const location = useLocation();

  const isProjectView = useMemo(
    () =>
      (location.pathname.includes('/projects/') && !location.pathname.endsWith('/projects')) ||
      location.pathname.includes('/worklenz/schedule'),
    [location.pathname]
  );

  const isProjectListView = useMemo(
    () => location.pathname.includes('/projects') && location.search.includes('page='),
    [location.pathname, location.search]
  );

  const contentClassName = [
    'px-4 sm:px-8 lg:px-12 xl:px-16 mx-auto w-full',
    !isProjectView ? 'overflow-x-hidden max-w-[1400px]' : '',
    isProjectListView ? 'overflow-x-hidden max-w-[1600px]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <ImportProgressNotifier />
      <Layout className="min-h-screen">
        <MobileAppBanner />
        <TrialExpirationAlert />

        <Layout.Header
          className={`sticky top-0 z-[999] flex items-center p-0 shadow-md ${
            themeMode === 'dark' ? 'border-b border-[#303030]' : 'shadow-[#18181811]'
          }`}
        >
          <Navbar />
        </Layout.Header>

        <Layout.Content className={contentClassName}>
          <Outlet />
        </Layout.Content>
      </Layout>

      <UpgradePlansModal />
    </>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
