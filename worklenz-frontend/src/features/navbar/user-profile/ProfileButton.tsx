import {
  DashboardOutlined,
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
  CreditCardOutlined,
  DeleteOutlined,
} from '@/shared/antd-imports';
import {
  Card,
  Dropdown,
  Flex,
  MenuProps,
  Tooltip,
  Typography,
  MoonOutlined,
  SunOutlined,
  theme,
} from '@/shared/antd-imports';
import { MobileOutlined } from '@ant-design/icons';

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { memo, useState } from 'react';
import MobileAppModal from '@/components/mobile-app/MobileAppModal';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleTheme } from '@/features/theme/themeSlice';
import { RootState } from '@/app/store';
import { selectCurrentProject } from '@/app/selectors';

import { getRole } from '@/utils/session-helper';
import { RoleName } from '@/types/roles/role.types';

import './profile-dropdown.css';
import './profile-button.css';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useAuthService } from '@/hooks/useAuth';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useTooltipTheme } from '@/hooks/useTooltipTheme';

const { useToken } = theme;

interface ProfileButtonProps {
  isOwnerOrAdmin: boolean;
}

const ProfileButton = ({ isOwnerOrAdmin }: ProfileButtonProps) => {
  const { t } = useTranslation('navbar');
  const { tooltipProps } = useTooltipTheme();
  const currentSession = useAppSelector((state: RootState) => state.userReducer);
  const currentProject = useAppSelector(selectCurrentProject);
  const { isLicenseExpired } = useAuthStatus();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const dispatch = useAppDispatch();
  const { token } = useToken();

  const role = getRole();

  // Record<RoleName, string> ensures this stays in sync with the role set;
  // TypeScript errors if a role is added without a matching translation key here.
  const ROLE_TRANSLATION_KEY: Record<RoleName, string> = {
    Owner: 'ownerRole',
    Admin: 'adminRole',
    'Team Lead': 'teamLeadRole',
    Member: 'memberRole',
  };
  const roleTranslationKey = role === 'Unknown' ? undefined : ROLE_TRANSLATION_KEY[role];
  const profileRole = currentProject?.project?.is_guest
    ? t('guestRole', { defaultValue: 'Guest' })
    : roleTranslationKey
      ? t(roleTranslationKey, { defaultValue: roleTranslationKey })
      : role;
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const itemStyle = {
    color: token.colorText,
  };

  const dangerItemStyle = {
    color: token.colorError,
  };

  const iconStyle = {
    display: 'flex',
    alignItems: 'center',
    fontSize: 14,
    color: token.colorTextSecondary,
  } as const;

  const handleItemMouseEnter = (e: { currentTarget: HTMLElement }) => {
    e.currentTarget.style.background = token.colorFillTertiary;
  };

  const handleItemMouseLeave = (e: { currentTarget: HTMLElement }) => {
    e.currentTarget.style.background = 'transparent';
  };

  const profile: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card
          className={`profile-card ${themeMode === 'dark' ? 'dark' : ''}`}
          title={
            <div style={{ paddingBlock: '12px' }}>
              <Typography.Text
                style={{ fontSize: 12, fontWeight: 500, color: token.colorTextSecondary }}
              >
                {t('account', { defaultValue: 'Account' })}
              </Typography.Text>
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
                    ({profileRole})
                  </Typography.Text>
                </Flex>
              </Flex>
            </div>
          }
          variant="borderless"
          style={{ width: 230 }}
        >
          {isOwnerOrAdmin && (
            <Link
              to="/worklenz/admin-center/overview"
              style={itemStyle}
              onMouseEnter={handleItemMouseEnter}
              onMouseLeave={handleItemMouseLeave}
            >
              <span style={iconStyle}>
                <DashboardOutlined />
              </span>
              {t('adminCenter', { defaultValue: 'Admin Center' })}
            </Link>
          )}
          {isOwnerOrAdmin && (
            <Link
              to="/worklenz/admin-center/billing"
              style={itemStyle}
              onMouseEnter={handleItemMouseEnter}
              onMouseLeave={handleItemMouseLeave}
              onClick={() => {
                trackMixpanelEvent('billing_profile_dropdown_click', {
                  user_type: currentSession?.subscription_type?.toLowerCase(),
                  is_owner_or_admin: true,
                });
              }}
            >
              <span style={iconStyle}>
                <CreditCardOutlined />
              </span>
              {t('billing', { defaultValue: 'Billing' })}
            </Link>
          )}
          {!isLicenseExpired && (
            <Link
              to="/worklenz/settings/profile"
              style={itemStyle}
              onMouseEnter={handleItemMouseEnter}
              onMouseLeave={handleItemMouseLeave}
            >
              <span style={iconStyle}>
                <SettingOutlined />
              </span>
              {t('settings', { defaultValue: 'Settings' })}
            </Link>
          )}
          {!isLicenseExpired && (
            <div
              onClick={() => { setMobileModalOpen(true); setDropdownOpen(false); }}
              onMouseEnter={handleItemMouseEnter}
              onMouseLeave={handleItemMouseLeave}
              style={{ ...itemStyle, cursor: 'pointer', fontWeight: 600 }}
            >
              <span style={iconStyle}>
                <MobileOutlined />
              </span>
              {t('getMobileApp', { defaultValue: 'Get Mobile App' })}
            </div>
          )}
          {isLicenseExpired && (
            <Link
              to="/worklenz/settings/account-deletion"
              style={dangerItemStyle}
              onMouseEnter={handleItemMouseEnter}
              onMouseLeave={handleItemMouseLeave}
            >
              <span style={{ ...iconStyle, color: token.colorError }}>
                <DeleteOutlined />
              </span>
              {t('deleteAccount', { defaultValue: 'Delete Account' })}
            </Link>
          )}
          <div
            onClick={() => dispatch(toggleTheme())}
            onMouseEnter={handleItemMouseEnter}
            onMouseLeave={handleItemMouseLeave}
            style={{
              ...itemStyle,
              cursor: 'pointer',
              justifyContent: 'space-between',
            }}
          >
            <Flex gap={8} align="center">
              <span style={iconStyle}>{isDark ? <SunOutlined /> : <MoonOutlined />}</span>
              <span>{isDark ? t('lightMode', { defaultValue: 'Light Mode' }) : t('darkMode', { defaultValue: 'Dark Mode' })}</span>
            </Flex>
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: 10,
                background: isDark ? token.colorPrimary : token.colorFillSecondary,
                color: isDark ? token.colorWhite ?? '#fff' : token.colorTextSecondary,
              }}
            >
               {isDark ? t('themeToggleOn', { defaultValue: 'ON' }) : t('themeToggleOff', { defaultValue: 'OFF' })}
            </span>
          </div>
          <Link
            to="/auth/logging-out"
            style={itemStyle}
            onMouseEnter={handleItemMouseEnter}
            onMouseLeave={handleItemMouseLeave}
          >
            <span style={iconStyle}>
              <LogoutOutlined />
            </span>
            {t('logOut', { defaultValue: 'Log Out' })}
          </Link>
        </Card>
      ),
    },
  ];

  return (
    <>
      <Dropdown
        overlayClassName="profile-dropdown"
        overlayStyle={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}
        menu={{ items: profile }}
        placement="bottomRight"
        trigger={['click']}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
      >
        <Tooltip title={t('profileTooltip', { defaultValue: 'Profile' })} {...tooltipProps}>
          <button className="profile-button">
            {currentSession?.avatar_url ? (
              <SingleAvatar
                avatarUrl={currentSession.avatar_url}
                name={currentSession.name}
                email={currentSession.email}
                size={32}
                marginRight={0}
              />
            ) : (
              <UserOutlined style={{ fontSize: 20 }} />
            )}
          </button>
        </Tooltip>
      </Dropdown>

      <MobileAppModal open={mobileModalOpen} onClose={() => setMobileModalOpen(false)} />
    </>
  );
};

export default memo(ProfileButton);
