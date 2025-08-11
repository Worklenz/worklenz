import { Flex, Typography } from '@/shared/antd-imports';
import SettingsSidebar from '../pages/settings/sidebar/settings-sidebar';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';

const SettingsLayout = () => {
  const isTablet = useMediaQuery({ query: '(min-width: 768px)' });

  return (
    <div className="my-6 min-h-[90vh]">
      <Typography.Title level={4}>Settings</Typography.Title>

      {isTablet ? (
        <Flex
          gap={24}
          align="flex-start"
          className="w-full mt-6"
        >
          <Flex className="w-full max-w-60">
            <SettingsSidebar />
          </Flex>
          <Flex className="w-full">
            <Outlet />
          </Flex>
        </Flex>
      ) : (
        <Flex
          vertical
          gap={24}
          className="mt-6"
        >
          <SettingsSidebar />
          <Outlet />
        </Flex>
      )}
    </div>
  );
};

export default SettingsLayout;
