import { Layout, Modal } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';

import Navbar from '@/features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { TrialExpirationAlert } from '@/components/TrialExpirationAlert/TrialExpirationAlert';
import UpgradePlans from '@/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans';
import UpgradePlansLKR from '@/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAuthService } from '../hooks/useAuth';
import { ImportProgressNotifier } from '@/components/imports/ImportProgressNotifier';
import { useRegionCheck } from '../hooks/useRegionCheck';
import { MobileAppBanner } from '@/components/mobile-app/MobileAppBanner';

const LIFETIME_KEYWORDS = ['appsumo', 'life_time_deal', 'lifetime', 'life time'];

function containsLifetimeKeyword(value: string): boolean {
  return LIFETIME_KEYWORDS.some(kw => value.includes(kw));
}

const MainLayout = memo(() => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isUpgradeModalOpen, billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const currentSession = useAuthService().getCurrentSession();
  const location = useLocation();
  const { isLkrUser, regionCheckComplete } = useRegionCheck();

  const isAppSumoUser = useMemo(() => {
    const fields = [
      billingInfo?.plan_name,
      billingInfo?.subscription_type,
      currentSession?.subscription_type,
      currentSession?.subscription_status,
    ].map(v => v?.toLowerCase() ?? '');

    return fields.some(containsLifetimeKeyword);
  }, [billingInfo, currentSession]);

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

  const modalWidth = isLkrUser ? 'fit-content' : isAppSumoUser ? 700 : 1400;

  const contentClassName = [
    'px-4 sm:px-8 lg:px-12 xl:px-16 mx-auto w-full',
    !isProjectView ? 'overflow-x-clip max-w-[1400px]' : '',   // ✅ changed from overflow-x-hidden
    isProjectListView ? 'overflow-x-clip max-w-[1600px]' : '', // ✅ changed from overflow-x-hidden
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

      <Modal
        open={isUpgradeModalOpen}
        onCancel={() => dispatch(toggleUpgradeModal())}
        width={modalWidth}
        centered
        okButtonProps={{ hidden: true }}
        cancelButtonProps={{ hidden: true }}
        style={{ zIndex: 1000 }}
        destroyOnHidden
        maskClosable={false}
      >
        <div style={{ padding: '20px' }}>
          {regionCheckComplete ? (
            isLkrUser ? <UpgradePlansLKR /> : <UpgradePlans />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
          )}
        </div>
      </Modal>
    </>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;