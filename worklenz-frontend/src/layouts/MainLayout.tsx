import { ConfigProvider, Layout } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';

import Navbar from '@/features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { colors } from '../styles/colors';
import { TrialExpirationAlert } from '@/components/TrialExpirationAlert/TrialExpirationAlert';

const MainLayout = memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const location = useLocation();
  
  const isProjectView = location.pathname.includes('/projects/') && 
                       !location.pathname.endsWith('/projects');

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

        <Layout.Content className={`px-4 sm:px-8 lg:px-12 xl:px-16 ${!isProjectView ? 'overflow-x-hidden max-w-[1400px]' : ''} mx-auto w-full`}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
