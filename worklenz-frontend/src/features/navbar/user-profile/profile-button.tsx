import { UserOutlined } from '@ant-design/icons';
import { Button, Card, Dropdown, Flex, Tooltip, Typography } from '@/components/ui';

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAppSelector } from '@/hooks/use-app-selector';
import { RootState } from '@/app/store';

import { getRole } from '@/utils/session-helper';

import './profile-dropdown.css';
import './profile-button.css';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useAuthService } from '@/hooks/use-auth';
import React, { useCallback, useMemo } from 'react';

interface ProfileButtonProps {
  isOwnerOrAdmin: boolean;
}

const ProfileButton = React.memo(({ isOwnerOrAdmin }: ProfileButtonProps) => {
  const { t } = useTranslation('navbar');
  const authService = useAuthService();
  const currentSession = useAppSelector((state: RootState) => state.userReducer);
  
  const role = getRole();
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);

  // Memoize link styles to prevent recreation
  const getLinkStyle = useCallback(() => ({
    color: themeMode === 'dark' ? '#ffffffd9' : '#181818',
  }), [themeMode]);

  // Memoize button styles
  const buttonStyle = useMemo(() => ({
    height: '62px',
    width: '60px',
  }), []);

  // Memoize profile card content to prevent recreation
  const profileCardContent = useMemo(() => (
    <>
      {isOwnerOrAdmin && (
        <Link to="/worklenz/admin-center/overview" style={getLinkStyle()}>
          {t('adminCenter')}
        </Link>
      )}
      <Link to="/worklenz/settings/profile" style={getLinkStyle()}>
        {t('settings')}
      </Link>
      <Link to="/auth/logging-out" style={getLinkStyle()}>
        {t('logOut')}
      </Link>
    </>
  ), [isOwnerOrAdmin, getLinkStyle, t]);

  // Memoize profile card title to prevent recreation
  const profileCardTitle = useMemo(() => (
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
            ellipsis={{ tooltip: currentSession?.name }}
            style={{ width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {currentSession?.name}
          </Typography.Text>
          <Typography.Text
            ellipsis={{ tooltip: currentSession?.email }}
            style={{ fontSize: 12, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {currentSession?.email}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ({role})
          </Typography.Text>
        </Flex>
      </Flex>
    </div>
  ), [currentSession?.avatar_url, currentSession?.name, currentSession?.email, role]);

  // Memoize profile menu items to prevent recreation
  const profile = useMemo(() => [{
    key: '1',
    label: (
      <Card
        className={`profile-card ${themeMode === 'dark' ? 'dark' : ''}`}
        title={profileCardTitle}
        variant="borderless"
        style={{ width: 230 }}
      >
        {profileCardContent}
      </Card>
    ),
  }], [themeMode, profileCardTitle, profileCardContent]);

  // Memoize button icon to prevent recreation
  const buttonIcon = useMemo(() => {
    if (currentSession?.avatar_url) {
      return (
        <SingleAvatar
          avatarUrl={currentSession.avatar_url}
          name={currentSession.name}
          email={currentSession.email}
        />
      );
    }
    return <UserOutlined style={{ fontSize: 20 }} />;
  }, [currentSession?.avatar_url, currentSession?.name, currentSession?.email]);

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
          style={buttonStyle}
          type="text"
          icon={buttonIcon}
        />
      </Tooltip>
    </Dropdown>
  );
});

ProfileButton.displayName = 'ProfileButton';

export default ProfileButton;
