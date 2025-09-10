import { ConfigProvider, Layout, Modal, Button } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';

import Navbar from '@/features/navbar/navbar';
import BusinessPlanAnnouncement from '@/components/business-plan-announcement/BusinessPlanAnnouncement';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { colors } from '../styles/colors';
import { TrialExpirationAlert } from '@/components/TrialExpirationAlert/TrialExpirationAlert';
import UpgradePlans from '@/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans';
// import UpgradePlansLKR from '@/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAuthService } from '../hooks/useAuth';

const MainLayout = memo(() => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isUpgradeModalOpen, billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const currentSession = useAuthService().getCurrentSession();
  const location = useLocation();

  // Get browser timezone for upgrade plans
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Determine if user is AppSumo user for modal width
  const isAppSumoUser = useMemo(() => {
    const planName = billingInfo?.plan_name?.toLowerCase() || '';
    const subscriptionType = currentSession?.subscription_type?.toLowerCase() || '';
    
    // First check if user is on trial - trial users should never be considered AppSumo users
    if (currentSession?.subscription_type === 'TRIAL') {
      return false;
    }
    
    return (
      planName.includes('appsumo') ||
      subscriptionType.includes('appsumo') ||
      planName.includes('life_time_deal') ||
      subscriptionType.includes('life_time_deal')
    );
  }, [billingInfo, currentSession]);

  const isProjectView =
    (location.pathname.includes('/projects/') && !location.pathname.endsWith('/projects')) ||
    location.pathname.includes('/worklenz/schedule');

  const themeConfig = useMemo(
    () => ({
      components: {
        Layout: {
          colorBgLayout: themeMode === 'dark' ? colors.darkGray : colors.white,
          headerBg: themeMode === 'dark' ? colors.darkGray : colors.white,
        },
      },
    }),
    [themeMode]
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout className="min-h-screen">
        {/* Trial expiration alert banner */}
        <TrialExpirationAlert />
        <BusinessPlanAnnouncement />

        <Layout.Header
          className={`sticky top-0 z-[999] flex items-center p-0 shadow-md ${
            themeMode === 'dark' ? 'border-b border-[#303030]' : 'shadow-[#18181811]'
          }`}
        >
          <Navbar />
        </Layout.Header>

        <Layout.Content
          className={`px-4 sm:px-8 lg:px-12 xl:px-16 ${!isProjectView ? 'overflow-x-hidden max-w-[1400px]' : ''} mx-auto w-full`}
        >
          <Outlet />
        </Layout.Content>
      </Layout>

      {/* Global Upgrade Modal */}
      <Modal
        open={isUpgradeModalOpen}
        onCancel={() => dispatch(toggleUpgradeModal())}
        width={isAppSumoUser ? 900 : 1400}
        centered
        okButtonProps={{ hidden: true }}
        cancelButtonProps={{ hidden: true }}
        style={{ zIndex: 1000 }}
        destroyOnClose
        maskClosable={false}
      >
        <div style={{ padding: '20px' }}>
          {/* LKR pricing disabled for now - always show main upgrade plans */}
          <UpgradePlans />
          {/* {browserTimeZone === 'Asia/Colombo' ? <UpgradePlansLKR /> : <UpgradePlans />} */}
        </div>
      </Modal>
    </ConfigProvider>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
