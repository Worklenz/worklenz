import { UsergroupAddOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleInviteMemberDrawer } from '../../settings/member/memberSlice';
import { useAuthService } from '@/hooks/useAuth';

const InviteButton = () => {
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isInviteRestricted = Boolean(currentSession?.is_expired);

  // localization
  const { t } = useTranslation('navbar');
  const { t: tCommon } = useTranslation('common');

  const inviteTooltip = isInviteRestricted
    ? tCommon('license-expired-subtitle', {
        defaultValue:
          'Your Worklenz subscription has ended. Please renew to continue enjoying all features.',
      })
    : t('inviteTooltip', {
        defaultValue: 'Invite team members',
      });

  return (
    <Tooltip title={inviteTooltip}>
      <Button
        type="dashed"
        icon={<UsergroupAddOutlined />}
        style={{
          color: colors.skyBlue,
          borderColor: colors.skyBlue,
          padding: '10px 16px',
        }}
        disabled={isInviteRestricted}
        onClick={() => {
          if (isInviteRestricted) return;
          dispatch(toggleInviteMemberDrawer());
        }}
      >
        {t('invite', { defaultValue: 'Invite' })}
      </Button>
    </Tooltip>
  );
};

export default memo(InviteButton);
