import { Button, ConfigProvider, Flex, Menu, MenuProps, Typography } from '@/shared/antd-imports';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { clientViewItems } from '../../../lib/client-view/client-view-constants';
import {
  LeftCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RightCircleOutlined,
} from '@ant-design/icons';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import { useAppSelector } from '../../../hooks/useAppSelector';

type ClientViewSiderMenuProps = {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
};

const ClientViewSiderMenu = ({ isCollapsed, setIsCollapsed }: ClientViewSiderMenuProps) => {
  const location = useLocation();
  // localization
  const { t } = useTranslation('client-view-common');

  // theme details from theme slice
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  type MenuItem = Required<MenuProps>['items'][number];
  // import menu items from client view sidebar constants
  const menuItems = clientViewItems;

  // function for get the active menu item
  const getCurrentActiveKey = () => {
    try {
      // this one return the string after client-portal/
      const afterClientPortalString = location.pathname.split('/client-portal/')[1];

      if (!afterClientPortalString) {
        return 'dashboard'; // Default to dashboard if no sub-path
      }

      // this one return the string after client-portal/ **pathKey** /
      const pathKey = afterClientPortalString.split('/')[0];

      return pathKey || 'dashboard';
    } catch (error) {
      return 'dashboard'; // Fallback to dashboard
    }
  };

  // menu items
  const items: MenuItem[] = [
    ...menuItems.map(item => ({
      disabled: item.disabled,
      key: item.key,
      label: (
        <Flex gap={8} justify="space-between">
          <Link
            to={`/client-portal/${item.endpoint}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <div>{item.icon}</div>
            {!isCollapsed && <div>{t(item.name)}</div>}
          </Link>
        </Flex>
      ),
    })),
  ];

  // function to handle collapse
  const handleCollapsedToggler = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <ConfigProvider
      wave={{ disabled: true }}
      theme={{
        components: {
          Menu: {
            itemHoverBg: colors.transparent,
            itemHoverColor: colors.skyBlue,
            borderRadius: 12,
            itemMarginBlock: 4,
          },
          Button: {
            paddingInline: 20,
            paddingBlock: 24,
          },
        },
      }}
    >
      <Flex vertical gap={12} style={{ width: '100%', position: 'relative' }}>
        {/* collapse button  */}
        <Button
          className="borderless-icon-btn"
          style={{
            position: 'absolute',
            right: 0,
            top: -36,
            background: themeWiseColor(colors.white, colors.darkGray, themeMode),
            boxShadow: 'none',
            padding: 0,
            zIndex: 120,
            transform: 'translateX(50%)',
          }}
          onClick={() => handleCollapsedToggler()}
          icon={
            isCollapsed ? (
              <RightCircleOutlined
                style={{
                  fontSize: 22,
                  color: themeWiseColor('#c5c5c5', colors.lightGray, themeMode),
                }}
              />
            ) : (
              <LeftCircleOutlined
                style={{
                  fontSize: 22,
                  color: themeWiseColor('#c5c5c5', colors.lightGray, themeMode),
                }}
              />
            )
          }
        />
        <Menu
          defaultValue={'dashboard'}
          className="custom-reporting-sider"
          items={items}
          selectedKeys={[getCurrentActiveKey()]}
          mode="vertical"
          style={{ border: 'none', width: '100%' }}
        />
      </Flex>
    </ConfigProvider>
  );
};

export default ClientViewSiderMenu;
