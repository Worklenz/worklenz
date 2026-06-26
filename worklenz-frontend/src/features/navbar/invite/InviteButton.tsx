import { UsergroupAddOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleInviteMemberDrawer } from '../../settings/member/memberSlice';
import { useAuthService } from '@/hooks/useAuth';
import { ROLE_DEFINITIONS } from '@/types/roles/role.types';
import { getSessionRoleName } from '@/utils/role-permissions.utils';

const InviteButton = () => {
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isInviteRestricted = Boolean(currentSession?.is_expired);
  const currentRole = getSessionRoleName(currentSession);
  const canInviteMembers = ROLE_DEFINITIONS[currentRole].canInviteMembers;

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

  if (!canInviteMembers) {
    return null;
  }

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
