import { UsergroupAddOutlined } from '@ant-design/icons';
import { Button, Tooltip } from '@/components/ui';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { toggleInviteMemberDrawer } from '@/features/settings/member/member.slice';

const InviteButton = React.memo(() => {
  const dispatch = useAppDispatch();

  // localization
  const { t } = useTranslation('navbar');

  // Memoize click handler to prevent recreation on every render
  const handleInviteClick = useCallback(() => {
    dispatch(toggleInviteMemberDrawer());
  }, [dispatch]);

  // Memoize button styles to prevent recreation
  const buttonStyle = useMemo(() => ({
    color: colors.skyBlue,
    borderColor: colors.skyBlue,
  }), []);

  return (
    <Tooltip title={t('inviteTooltip')}>
      <Button
        type="dashed"
        icon={<UsergroupAddOutlined />}
        style={buttonStyle}
        onClick={handleInviteClick}
      >
        {t('invite')}
      </Button>
    </Tooltip>
  );
});

InviteButton.displayName = 'InviteButton';

export default InviteButton;
