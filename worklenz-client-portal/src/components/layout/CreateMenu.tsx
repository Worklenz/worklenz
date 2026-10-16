import { useState } from 'react';
import { CaretDownFilled } from '@ant-design/icons';
import { Button, Dropdown, UserAddOutlined, FileTextOutlined, theme } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useClientAccess } from '@/hooks/useClientAccess';
import { InviteLinkModal } from '@/components/v2/InviteLinkModal';
import { NewChangeRequestModal } from '@/components/v2/NewChangeRequestModal';

/**
 * The top bar "+" create menu, like the main app's: a round primary button that offers the things a
 * client can start from anywhere. Items this person's role cannot use stay visible but disabled.
 */
export const CreateMenu = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { can, adminsCanInvite } = useClientAccess();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);

  const items: MenuProps['items'] = [
    {
      key: 'member',
      icon: <UserAddOutlined />,
      disabled: !(can.manageUsers && adminsCanInvite),
      label: t('create.newMember', { defaultValue: 'New member' }),
      onClick: () => setInviteOpen(true),
    },
    {
      key: 'change-request',
      icon: <FileTextOutlined />,
      disabled: !can.submitChangeRequest,
      label: t('create.newChangeRequest', { defaultValue: 'New change request' }),
      onClick: () => setChangeRequestOpen(true),
    },
  ];

  return (
    <>
      <Dropdown overlayClassName="portal-profile-dropdown" menu={{ items }} trigger={['click']} placement="bottomRight">
        <Button type="text" shape="round" style={{ border: `1px solid ${token.colorBorder}` }}>
          {t('create.label', { defaultValue: 'Add new' })}
          <CaretDownFilled aria-hidden style={{ fontSize: 10 }} />
        </Button>
      </Dropdown>
      <InviteLinkModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <NewChangeRequestModal open={changeRequestOpen} onClose={() => setChangeRequestOpen(false)} />
    </>
  );
};
