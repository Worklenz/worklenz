import React, { useEffect, useMemo, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';
import Flex from 'antd/es/flex';
import Typography from 'antd/es/typography';

import AdminCenterSidebar from '@/pages/admin-center/sidebar/sidebar';
import { verifyAuthentication } from '@/features/auth/auth-slice';
import { useAppDispatch } from '@/hooks/use-app-dispatch';

interface AdminCenterLayoutProps {}

const AdminCenterLayout: React.FC<AdminCenterLayoutProps> = React.memo(() => {
  const dispatch = useAppDispatch();
  const isTablet = useMediaQuery({ query: '(min-width:768px)' });
  const isMarginAvailable = useMediaQuery({ query: '(min-width: 1000px)' });
  const { t } = useTranslation('admin-center/sidebar');

  // Memoize authentication verification
  const verifyAuth = useCallback(() => {
    void dispatch(verifyAuthentication());
  }, [dispatch]);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  // Memoize styles to prevent recreation on every render
  const containerStyles = useMemo(() => ({
    marginBlock: 96,
    minHeight: '90vh',
    marginLeft: isMarginAvailable ? '5%' : '',
    marginRight: isMarginAvailable ? '5%' : '',
  }), [isMarginAvailable]);

  const tabletFlexStyles = useMemo(() => ({
    width: '100%',
    marginBlockStart: 24,
  }), []);

  const sidebarStyles = useMemo(() => ({
    width: '100%',
    maxWidth: 240,
  }), []);

  const contentStyles = useMemo(() => ({
    width: '100%',
  }), []);

  const mobileFlexStyles = useMemo(() => ({
    marginBlockStart: 24,
  }), []);

  return (
    <div style={containerStyles}>
      <Typography.Title level={4}>{t('adminCenter')}</Typography.Title>

      {isTablet ? (
        <Flex
          gap={24}
          align="flex-start"
          style={tabletFlexStyles}
        >
          <Flex style={sidebarStyles}>
            <AdminCenterSidebar />
          </Flex>
          <Flex style={contentStyles}>
            <Outlet />
          </Flex>
        </Flex>
      ) : (
        <Flex
          vertical
          gap={24}
          style={mobileFlexStyles}
        >
          <AdminCenterSidebar />
          <Outlet />
        </Flex>
      )}
    </div>
  );
});

AdminCenterLayout.displayName = 'AdminCenterLayout';

export default AdminCenterLayout;
