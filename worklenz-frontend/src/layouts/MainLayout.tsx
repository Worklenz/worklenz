import { ConfigProvider, Layout, Modal, Button } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';

import Navbar from '@/features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { colors } from '../styles/colors';
import { TrialExpirationAlert } from '@/components/TrialExpirationAlert/TrialExpirationAlert';
import UpgradePlans from '@/components/admin-center/billing/drawers/upgrade-plans/upgrade-plans';
import UpgradePlansLKR from '@/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

const MainLayout = memo(() => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isUpgradeModalOpen } = useAppSelector(state => state.adminCenterReducer);
  const location = useLocation();

  // Get browser timezone for upgrade plans
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
        width={1400}
        centered
        okButtonProps={{ hidden: true }}
        cancelButtonProps={{ hidden: true }}
        style={{ zIndex: 1000 }}
        destroyOnClose
        maskClosable={false}
      >
        <div style={{ padding: '20px' }}>
          {browserTimeZone === 'Asia/Colombo' ? <UpgradePlansLKR /> : <UpgradePlans />}
        </div>
      </Modal>
    </ConfigProvider>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
