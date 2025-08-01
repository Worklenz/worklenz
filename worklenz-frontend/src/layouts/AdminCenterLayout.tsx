import { Flex, Typography } from '@/shared/antd-imports';
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import AdminCenterSidebar from '@/pages/admin-center/sidebar/sidebar';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';

const AdminCenterLayout: React.FC = () => {
  const isTablet = useMediaQuery({ query: '(min-width:768px)' });
  const { t } = useTranslation('admin-center/sidebar');

  return (
    <div
      style={{
        marginBlock: 24,
        minHeight: '90vh',
      }}
    >
      <Typography.Title level={4}>{t('adminCenter')}</Typography.Title>

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
            <AdminCenterSidebar />
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
          <AdminCenterSidebar />
          <Outlet />
        </Flex>
      )}
    </div>
  );
};

export default AdminCenterLayout;
