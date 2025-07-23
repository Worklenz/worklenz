import { UsergroupAddOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleInviteMemberDrawer } from '../../settings/member/memberSlice';

const InviteButton = () => {
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
        onClick={() => dispatch(toggleInviteMemberDrawer())}
      >
        {t('invite')}
      </Button>
    </Tooltip>
  );
};

export default InviteButton;
