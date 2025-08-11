import {
  ClockCircleOutlined,
  HomeOutlined,
  MenuOutlined,
  ProjectOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
} from '@/shared/antd-imports';
import { Button, Card, Dropdown, Flex, MenuProps, Space, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { NavLink } from 'react-router-dom';
import InviteButton from '../invite/InviteButton';
import SwitchTeamButton from '../switch-team/SwitchTeamButton';
// custom css
import './mobileMenu.css';

const MobileMenuButton = () => {
  // localization
  const { t } = useTranslation('navbar');

  const navLinks = [
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
  ];

  const mobileMenu: MenuProps['items'] = [
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

export default MobileMenuButton;
