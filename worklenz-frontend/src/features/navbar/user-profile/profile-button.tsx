import { Button, Card, Dropdown, Flex, MenuProps, Tooltip, Typography } from 'antd';
import { 
  UserOutlined, 
  SunOutlined, 
  MoonOutlined, 
  SettingOutlined, 
  LogoutOutlined,
  DashboardOutlined
} from '@/shared/antd-imports';

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { RootState } from '@/app/store';
import { toggleTheme } from '@/features/theme/themeSlice';

import { getRole } from '@/utils/session-helper';

import './profile-dropdown.css';
import './profile-button.css';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useAuthService } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';

interface ProfileButtonProps {
  isOwnerOrAdmin: boolean;
}

const ProfileButton = ({ isOwnerOrAdmin }: ProfileButtonProps) => {
  const { t } = useTranslation('navbar');
  const authService = useAuthService();
  const dispatch = useAppDispatch();
  const currentSession = useAppSelector((state: RootState) => state.userReducer);

  const role = getRole();
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);

  const getLinkStyle = () => ({
    color: themeMode === 'dark' ? '#ffffffd9' : '#181818',
  });

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  const profile: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card
          className={`profile-card ${themeMode === 'dark' ? 'dark' : ''}`}
          title={
            <div style={{ paddingBlock: '16px' }}>
              <Typography.Text>Account</Typography.Text>
              <Flex gap={8} align="center" justify="flex-start" style={{ width: '100%' }}>
                <SingleAvatar
                  avatarUrl={currentSession?.avatar_url}
                  name={currentSession?.name}
                  email={currentSession?.email}
                />
                <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text
                    ellipsis={{ tooltip: currentSession?.name }} // Show tooltip on hover
                    style={{
                      width: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {currentSession?.name}
                  </Typography.Text>
                  <Typography.Text
                    ellipsis={{ tooltip: currentSession?.email }} // Show tooltip on hover
                    style={{
                      fontSize: 12,
                      width: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {currentSession?.email}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    ({role})
                  </Typography.Text>
                </Flex>
              </Flex>
            </div>
          }
          variant="borderless"
          style={{ width: 230 }}
        >
          {isOwnerOrAdmin && (
            <Link to="/worklenz/admin-center/overview" style={getLinkStyle()}>
              <DashboardOutlined />
              {t('adminCenter')}
            </Link>
          )}
          <Link to="/worklenz/settings/profile" style={getLinkStyle()}>
            <SettingOutlined />
            {t('settings')}
          </Link>
          <div 
            onClick={handleThemeToggle}
            style={{
              ...getLinkStyle(),
              cursor: 'pointer',
            }}
          >
            {themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            {themeMode === 'dark' ? t('lightMode') : t('darkMode')}
          </div>
          <Link to="/auth/logging-out" style={getLinkStyle()}>
            <LogoutOutlined />
            {t('logOut')}
          </Link>
        </Card>
      ),
    },
  ];

  return (
    <Dropdown
      overlayClassName="profile-dropdown"
      menu={{ items: profile }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Tooltip title={t('profileTooltip')}>
        <Button
          className="profile-button"
          style={{ height: '62px', width: '60px' }}
          type="text"
          icon={
            currentSession?.avatar_url ? (
              <SingleAvatar
                avatarUrl={currentSession.avatar_url}
                name={currentSession.name}
                email={currentSession.email}
              />
            ) : (
              <UserOutlined style={{ fontSize: 20 }} />
            )
          }
        />
      </Tooltip>
    </Dropdown>
  );
};

export default ProfileButton;
