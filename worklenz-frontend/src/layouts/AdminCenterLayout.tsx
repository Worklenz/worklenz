import { Flex, Typography } from '@/shared/antd-imports';
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import AdminCenterSidebar from '@/pages/admin-center/sidebar/sidebar';
import { useTranslation } from 'react-i18next';

const AdminCenterLayout: React.FC = () => {
  const isTablet = useMediaQuery({ query: '(min-width:768px)' });
  const { t } = useTranslation('admin-center/sidebar');

  return (
    <div className="my-6">
      <Typography.Title level={4}>{t('adminCenter')}</Typography.Title>

      {isTablet ? (
        <Flex gap={24} align="flex-start" className="w-full mt-6">
          <Flex className="w-full max-w-60">
            <AdminCenterSidebar />
          </Flex>
          <Flex className="w-full">
            <Outlet />
          </Flex>
        </Flex>
      ) : (
        <Flex vertical gap={24} className="mt-6">
          <AdminCenterSidebar />
          <Outlet />
        </Flex>
      )}
    </div>
  );
};

export default AdminCenterLayout;
