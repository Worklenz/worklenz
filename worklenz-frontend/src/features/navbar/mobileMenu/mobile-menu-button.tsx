import {
  ClockCircleOutlined,
  HomeOutlined,
  MenuOutlined,
  ProjectOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { Button, Card, Dropdown, Flex, Space, Typography } from '@/components/ui';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { NavLink } from 'react-router-dom';
import InviteButton from '../invite/invite-button';
import SwitchTeamButton from '../switchTeam/switch-team-button';
// custom css
import './mobileMenu.css';

const MobileMenuButton = React.memo(() => {
  // localization
  const { t } = useTranslation('navbar');

  // Memoize navigation links to prevent recreation on every render
  const navLinks = useMemo(() => [
    {
      name: 'home',
      icon: React.createElement(HomeOutlined),
    },
    {
      name: 'projects',
      icon: React.createElement(ProjectOutlined),
    },
    {
      name: 'schedule',
      icon: React.createElement(ClockCircleOutlined),
    },
    {
      name: 'reporting',
      icon: React.createElement(ReadOutlined),
    },
    {
      name: 'help',
      icon: React.createElement(QuestionCircleOutlined),
    },
  ], []);

  // Memoize button styles to prevent recreation
  const upgradeButtonStyle = useMemo(() => ({
    backgroundColor: colors.lightBeige,
    color: 'black',
  }), []);

  const flexStyle = useMemo(() => ({
    width: '90%',
    marginInlineStart: 12,
    marginBlock: 6,
  }), []);

  // Memoize menu items to prevent recreation on every render
  const mobileMenu = useMemo(() => [{
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
          style={flexStyle}
        >
          <Button style={upgradeButtonStyle}>
            {t('upgradePlan')}
          </Button>
          <InviteButton />
          <SwitchTeamButton />
        </Flex>
      </Card>
    ),
  }], [navLinks, t, upgradeButtonStyle, flexStyle]);

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
