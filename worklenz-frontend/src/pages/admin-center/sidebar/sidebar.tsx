import { RightOutlined } from '@/shared/antd-imports';
import { ConfigProvider, Flex, Menu, MenuProps } from '@/shared/antd-imports';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { adminCenterItems } from '../../../lib/admin-center-constants';
import './sidebar.css';
import { useAuthService } from '@/hooks/useAuth';
import { isBusinessPlan } from '@/utils/subscription-utils';

const AdminCenterSidebar: React.FC = () => {
  const { t } = useTranslation('admin-center/sidebar');
  const location = useLocation();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();

  type MenuItem = Required<MenuProps>['items'][number];
  const menuItems = adminCenterItems.filter(item => {
    if (item.key === 'settings') {
      return isBusinessPlan(currentSession);
    }
    return true;
  });

  const items: MenuItem[] = [
    ...menuItems.map(item => ({
      key: item.key,
      label: (
        <Flex gap={8} justify="space-between" className="admin-center-sidebar-button">
          <Flex gap={8}>
            {item.icon}
            <Link to={`/worklenz/admin-center/${item.endpoint}`}>{t(item.name)}</Link>
          </Flex>
          <RightOutlined style={{ fontSize: 12, fontWeight: 'bold' }} />
        </Flex>
      ),
    })),
  ];

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemHoverBg: colors.transparent,
            itemHoverColor: colors.skyBlue,
            borderRadius: 12,
            itemMarginBlock: 4,
          },
        },
      }}
    >
      <Menu
        items={items}
        selectedKeys={[location.pathname.split('/worklenz/admin-center/')[1] || '']}
        mode="vertical"
        style={{ border: 'none', width: '100%' }}
      />
    </ConfigProvider>
  );
};

export default AdminCenterSidebar;
