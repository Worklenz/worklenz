import { UsergroupAddOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleInviteMemberDrawer } from '../../../features/settings/member/memberSlice';

const InviteButton = memo(() => {
  const dispatch = useAppDispatch();

  // localization
  const { t } = useTranslation('navbar');

  return (
    <Tooltip title={t('inviteTooltip')}>
      <Button
        type="dashed"
        icon={<UsergroupAddOutlined />}
        style={{
          color: colors.skyBlue,
          borderColor: colors.skyBlue,
        }}
        onClick={useCallback(() => dispatch(toggleInviteMemberDrawer()), [dispatch])}
      >
        {t('invite')}
      </Button>
    </Tooltip>
  );
});

InviteButton.displayName = 'InviteButton';

export default InviteButton;
