import { Flex, Typography } from '@/shared/antd-imports';
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useDebouncedMediaQuery } from '@/hooks/useDebouncedMediaQuery';
import AdminCenterSidebar from '@/pages/admin-center/sidebar/sidebar';
import { useTranslation } from 'react-i18next';

const AdminCenterLayout: React.FC = () => {
  const isTablet = useDebouncedMediaQuery({ query: '(min-width:768px)' });
  const { t } = useTranslation('admin-center/sidebar');

  return (
    <div className="my-6">
      {isTablet ? (
        <Flex gap={24} align="flex-start" className="w-full">
          {/* Sticky left column — title + sidebar together */}
          <Flex
            vertical
            className="w-full max-w-60"
            style={{ position: 'sticky', top: 80, height: 'fit-content' }}
          >
            <Typography.Title level={4} style={{ marginBottom: 24 }}>
              {t('adminCenter')}
            </Typography.Title>
            <AdminCenterSidebar />
          </Flex>

          {/* Scrollable content */}
          <Flex className="w-full">
            <Outlet />
          </Flex>
        </Flex>
      ) : (
        <Flex vertical gap={24} className="mt-6">
          <Typography.Title level={4}>{t('adminCenter')}</Typography.Title>
          <AdminCenterSidebar />
          <Outlet />
        </Flex>
      )}
    </div>
  );
};

export default AdminCenterLayout;
