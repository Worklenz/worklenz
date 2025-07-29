import { Flex, Typography } from '@/shared/antd-imports';
import SettingsSidebar from '../pages/settings/sidebar/settings-sidebar';
import { Outlet, useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { useEffect } from 'react';
import { useAuthService } from '@/hooks/useAuth';

const SettingsLayout = () => {
  const isTablet = useMediaQuery({ query: '(min-width: 768px)' });
  const { getCurrentSession } = useAuthService();
  const currentSession = getCurrentSession();
  const navigate = useNavigate();

  

  return (
    <div style={{ marginBlock: 96, minHeight: '90vh' }}>
      <Typography.Title level={4}>Settings</Typography.Title>

      {isTablet ? (
        <Flex
          gap={24}
          align="flex-start"
          style={{
            width: '100%',
            marginBlockStart: 24,
          }}
        >
          <Flex style={{ width: '100%', maxWidth: 240 }}>
            <SettingsSidebar />
          </Flex>
          <Flex style={{ width: '100%' }}>
            <Outlet />
          </Flex>
        </Flex>
      ) : (
        <Flex
          vertical
          gap={24}
          style={{
            marginBlockStart: 24,
          }}
        >
          <SettingsSidebar />
          <Outlet />
        </Flex>
      )}
    </div>
  );
};

export default SettingsLayout;
