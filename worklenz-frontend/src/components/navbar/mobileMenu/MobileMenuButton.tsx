import {
  Button,
  Card,
  Dropdown,
  Flex,
  MenuProps,
  Space,
  Typography,
  HomeOutlined,
  MenuOutlined,
  ProjectOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
} from '@/shared/antd-imports';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import { NavLink } from 'react-router-dom';
import InviteButton from '@/components/navbar/invite/InviteButton';
import SwitchTeamButton from '@/components/navbar/switchTeam/SwitchTeamButton';
// custom css
import './MobileMenuButton.css';

const MobileMenuButton = memo(() => {
  // localization
  const { t } = useTranslation('navbar');

  const navLinks = useMemo(
    () => [
      {
        name: 'home',
        icon: React.createElement(HomeOutlined),
      },
      {
        name: 'projects',
        icon: React.createElement(ProjectOutlined),
      },
      // {
      //   name: 'schedule',
      //   icon: React.createElement(ClockCircleOutlined),
      // },
      {
        name: 'reporting',
        icon: React.createElement(ReadOutlined),
      },
      {
        name: 'help',
        icon: React.createElement(QuestionCircleOutlined),
      },
    ],
    []
  );

  const mobileMenu: MenuProps['items'] = useMemo(
    () => [
      {
        key: '1',
        label: (
          <Card className="mobile-menu-card" bordered={false} style={{ width: 230 }}>
            {navLinks.map((navEl, index) => (
              <NavLink key={index} to={`/worklenz/${navEl.name}`}>
                <Typography.Text strong>
                  <Space>
                    {navEl.icon}
                    {t(navEl.name)}
                  </Space>
                </Typography.Text>
              </NavLink>
            ))}

            <Flex
              vertical
              gap={12}
              style={{
                width: '90%',
                marginInlineStart: 12,
                marginBlock: 6,
              }}
            >
              <Button
                style={{
                  backgroundColor: colors.lightBeige,
                  color: 'black',
                }}
              >
                {t('upgradePlan')}
              </Button>
              <InviteButton />
              <SwitchTeamButton />
            </Flex>
          </Card>
        ),
      },
    ],
    [navLinks, t]
  );

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
});

MobileMenuButton.displayName = 'MobileMenuButton';

export default MobileMenuButton;
