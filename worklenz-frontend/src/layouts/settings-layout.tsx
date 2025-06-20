import React, { useEffect, useMemo, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import Flex from 'antd/es/flex';
import Typography from 'antd/es/typography';

import SettingsSidebar from '../pages/settings/sidebar/settings-sidebar';
import { useAuthService } from '@/hooks/use-auth';

interface SettingsLayoutProps {}

const SettingsLayout: React.FC<SettingsLayoutProps> = React.memo(() => {
  const isTablet = useMediaQuery({ query: '(min-width: 768px)' });
  const { getCurrentSession } = useAuthService();
  const currentSession = getCurrentSession();
  const navigate = useNavigate();

  // Memoize the navigation callback to prevent recreation
  const handleLicenseExpired = useCallback(() => {
    if (currentSession?.is_expired) {
      navigate('/worklenz/license-expired');
    }
  }, [currentSession?.is_expired, navigate]);

  useEffect(() => {
    handleLicenseExpired();
  }, [handleLicenseExpired]);

  // Memoize styles to prevent recreation on every render
  const containerStyles = useMemo(() => ({
    marginBlock: 96,
    minHeight: '90vh',
  }), []);

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
      <Typography.Title level={4}>Settings</Typography.Title>

      {isTablet ? (
        <Flex
          gap={24}
          align="flex-start"
          style={tabletFlexStyles}
        >
          <Flex style={sidebarStyles}>
            <SettingsSidebar />
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
          <SettingsSidebar />
          <Outlet />
        </Flex>
      )}
    </div>
  );
});

SettingsLayout.displayName = 'SettingsLayout';

export default SettingsLayout;
