import { Layout, Modal } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useEffect, useMemo } from 'react';

import Navbar from '@/features/navbar/navbar';
// import BusinessPlanAnnouncement from '@/components/business-plan-announcement/BusinessPlanAnnouncement';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { TrialExpirationAlert } from '@/components/TrialExpirationAlert/TrialExpirationAlert';
import UpgradePlans from '@/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans';
// import UpgradePlansLKR from '@/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAuthService } from '../hooks/useAuth';
import { ImportProgressNotifier } from '@/components/imports/ImportProgressNotifier';
import { fetchOrgConfig } from '@/features/org-config/org-config.slice';

const MainLayout = memo(() => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isUpgradeModalOpen, billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const currentSession = useAuthService().getCurrentSession();
  const location = useLocation();

  // Load org configuration once on mount (needed for task creation restriction feature)
  useEffect(() => {
    void dispatch(fetchOrgConfig());
  }, [dispatch]);

  // Get browser timezone for upgrade plans
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Determine if user is AppSumo user for modal width
  const isAppSumoUser = useMemo(() => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';
    const subscriptionStatus = currentSession?.subscription_status?.toLowerCase() || '';
    const billingSubscriptionType = billingInfo?.subscription_type?.toLowerCase() || '';

    // Check if user has AppSumo/Lifetime subscription in any of their subscription data
    // Note: Users on trial who were originally AppSumo users should still be considered AppSumo users
    // They get to see AppSumo pricing even during trial period
    // Important: subscription_status persists as "life_time_deal" even during trial!
    return (
      planName.includes('appsumo') ||
      planName.includes('life_time_deal') ||
      planName.includes('lifetime') ||
      planName.includes('life time') ||
      subscriptionType.includes('appsumo') ||
      subscriptionType.includes('life_time_deal') ||
      subscriptionStatus.includes('life_time_deal') ||
      subscriptionStatus.includes('lifetime') ||
      subscriptionStatus.includes('life time') ||
      billingSubscriptionType.includes('appsumo') ||
      billingSubscriptionType.includes('life_time_deal') ||
      billingSubscriptionType.includes('lifetime') ||
      billingSubscriptionType.includes('life time')
    );
  }, [billingInfo, currentSession]);

  const isProjectView =
    (location.pathname.includes('/projects/') && !location.pathname.endsWith('/projects')) ||
    location.pathname.includes('/worklenz/schedule');

  const isProjectListView =
    location.pathname.includes('/projects') && location.search.includes('page=');

  return (
    <>
      <ImportProgressNotifier />
      <Layout className="min-h-screen">
        {/* Trial expiration alert banner */}
        <TrialExpirationAlert />
        {/* <BusinessPlanAnnouncement /> */}

        <Layout.Header
          className={`sticky top-0 z-[999] flex items-center p-0 shadow-md ${themeMode === 'dark' ? 'border-b border-[#303030]' : 'shadow-[#18181811]'
            }`}
        >
          <Navbar />
        </Layout.Header>

        <Layout.Content
          className={`px-4 sm:px-8 lg:px-12 xl:px-16 ${!isProjectView ? 'overflow-x-hidden max-w-[1400px]' : ''} ${isProjectListView ? 'overflow-x-hidden max-w-[1600px]' : ''} mx-auto w-full`}
        >
          <Outlet />
        </Layout.Content>
      </Layout>

      {/* Global Upgrade Modal */}
      <Modal
        open={isUpgradeModalOpen}
        onCancel={() => dispatch(toggleUpgradeModal())}
        width={isAppSumoUser ? 700 : 1400}
        centered
        okButtonProps={{ hidden: true }}
        cancelButtonProps={{ hidden: true }}
        style={{ zIndex: 1000 }}
        destroyOnHidden
        maskClosable={false}
      >
        <div style={{ padding: '20px' }}>
          {/* LKR pricing disabled for now - always show main upgrade plans */}
          <UpgradePlans />
          {/* {browserTimeZone === 'Asia/Colombo' ? <UpgradePlansLKR /> : <UpgradePlans />} */}
        </div>
      </Modal>
    </>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
