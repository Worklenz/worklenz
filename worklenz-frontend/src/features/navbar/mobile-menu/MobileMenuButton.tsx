import {
  AppstoreOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  DollarOutlined,
  GroupOutlined,
  HomeOutlined,
  MenuOutlined,
  ProjectOutlined,
  ReadOutlined,
} from '@/shared/antd-imports';
import { Card, Dropdown, Flex, MenuProps, Space, theme, Typography } from '@/shared/antd-imports';
import React, { memo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import InviteButton from '../invite/InviteButton';
import SwitchTeamButton from '../switch-team/SwitchTeamButton';
import { isRouteGatedForFreePlan, NavRoutesType } from '../navRoutes';
// custom css
import './mobileMenu.css';
import { Button } from 'antd';

// Keyed by NavRoutesType['name'] — mirrors every entry in navRoutes.ts so the
// mobile menu always has an icon for whatever the desktop nav currently shows.
const ROUTE_ICONS: Record<string, ReactNode> = {
  home: React.createElement(HomeOutlined),
  projects: React.createElement(ProjectOutlined),
  planner: React.createElement(ClockCircleOutlined),
  'client-portal': React.createElement(GroupOutlined),
  finance: React.createElement(DollarOutlined),
  reporting: React.createElement(ReadOutlined),
  'Team Reports': React.createElement(BarChartOutlined),
};
const DEFAULT_ROUTE_ICON = React.createElement(AppstoreOutlined);

interface MobileMenuButtonProps {
  routes: NavRoutesType[];
  isFreePlan: boolean;
}

const MobileMenuButton = ({ routes, isFreePlan }: MobileMenuButtonProps) => {
  // localization
  const { t } = useTranslation('navbar');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();

  const mobileMenu: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="mobile-menu-card" bordered={false} style={{ width: 230 }}>
          {routes.map((route, index) => {
            const gated = isRouteGatedForFreePlan(route, isFreePlan);
            const content = (
              <Typography.Text strong style={{ color: token.colorText }}>
                <Space>
                  {ROUTE_ICONS[route.name] ?? DEFAULT_ROUTE_ICON}
                  {t(route.name)}
                  {gated && (
                    <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
                  )}
                </Space>
              </Typography.Text>
            );

            // Free-plan users tapping a gated route open the same upgrade
            // modal desktop's handleMenuClick opens — never navigate them
            // straight to a paid route.
            return gated ? (
              <a
                key={index}
                role="button"
                tabIndex={0}
                onClick={() => dispatch(toggleUpgradeModal())}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dispatch(toggleUpgradeModal());
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {content}
              </a>
            ) : (
              <NavLink key={index} to={route.path}>
                {content}
              </NavLink>
            );
          })}

          <Flex
            vertical
            gap={12}
            style={{
              width: '90%',
              marginInlineStart: 12,
              marginBlock: 6,
            }}
          >
            <InviteButton />
            <SwitchTeamButton />
          </Flex>
        </Card>
      ),
    },
  ];

  return (
    <Dropdown
      overlayClassName="mobile-menu-dropdown"
      menu={{ items: mobileMenu }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Button className="borderless-icon-btn" icon={<MenuOutlined style={{ fontSize: 20 }} />} />
    </Dropdown>
  );
};

export default memo(MobileMenuButton);