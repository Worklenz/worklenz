import { DashboardOutlined, LogoutOutlined, UserOutlined } from '@/shared/antd-imports';
import {
  Button,
  Card,
  Dropdown,
  Flex,
  MenuProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { MobileOutlined } from '@ant-design/icons';

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { memo, useState } from 'react';
import MobileAppModal from '@/components/mobile-app/MobileAppModal';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { RootState } from '@/app/store';

import { getRole } from '@/utils/session-helper';

import './profile-dropdown.css';
import './profile-button.css';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useAuthService } from '@/hooks/useAuth';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

interface ProfileButtonProps {
  isOwnerOrAdmin: boolean;
}

const ProfileButton = ({ isOwnerOrAdmin }: ProfileButtonProps) => {
  const { t } = useTranslation('navbar');
  const currentSession = useAppSelector((state: RootState) => state.userReducer);
  const { isLicenseExpired } = useAuthStatus();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const role = getRole();
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getLinkStyle = () => ({
    color: themeMode === 'dark' ? '#ffffffd9' : '#181818',
  });

  const getDangerLinkStyle = () => ({
    color: '#ff4d4f',
  });

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
              {t('adminCenter')}
            </Link>
          )}
          {isOwnerOrAdmin && (
            <Link
              to="/worklenz/admin-center/billing"
              style={getLinkStyle()}
              onClick={() => {
                trackMixpanelEvent('billing_profile_dropdown_click', {
                  user_type: currentSession?.subscription_type?.toLowerCase(),
                  is_owner_or_admin: true,
                });
              }}
            >
              {t('billing', { defaultValue: 'Billing' })}
            </Link>
          )}
          {!isLicenseExpired && (
            <Link to="/worklenz/settings/profile" style={getLinkStyle()}>
              {t('settings')}
            </Link>
          )}
          {!isLicenseExpired && (
            <div
              onClick={() => { setMobileModalOpen(true); setDropdownOpen(false); }}
              style={{ ...getLinkStyle(), cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
            >
              {t('getMobileApp')}
            </div>
          )}
          {isLicenseExpired && (
            <Link to="/worklenz/settings/account-deletion" style={getDangerLinkStyle()}>
              {t('deleteAccount')}
            </Link>
          )}
          <Link to="/auth/logging-out" style={getLinkStyle()}>
            {t('logOut')}
          </Link>
        </Card>
      ),
    },
  ];

  return (
    <>
      <Dropdown
        overlayClassName="profile-dropdown"
        menu={{ items: profile }}
        placement="bottomRight"
        trigger={['click']}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
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

      <MobileAppModal open={mobileModalOpen} onClose={() => setMobileModalOpen(false)} />
    </>
  );
};

export default memo(ProfileButton);
