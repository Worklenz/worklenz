import React from 'react';
import { useTranslation } from 'react-i18next';
import { Flex } from '@/shared/antd-imports';
import type { ClientUser, OrganizationPortalAccess } from '@/types/client-portal/v2';
import { formatPortalDate } from './format';
import { StatusTag } from './StatusTag';

const NS = 'client-portal-v2';

type UserStatusFields = Pick<
  ClientUser,
  'status' | 'invite_expired' | 'invite_not_sent' | 'new_link_requested' | 'email_verified'
> &
  Partial<Pick<ClientUser, 'account_deleted_at' | 'restorable_until'>>;

/**
 * Invited / Active / Deactivated / Account deleted. "Invite expired" is a flag on an Invited user, not a
 * separate status, and is shown with the recovery and verification hints the spec asks for. "Account deleted"
 * is a person who deleted their own account: it is not the same as Deactivated, because staff cannot
 * reactivate it, only restore it until the window ends.
 */
export const UserStatusTag = ({ user }: { user: UserStatusFields }) => {
  const { t, i18n } = useTranslation(NS);

  if (user.status === 'active') {
    return <StatusTag tone="green">{t('userActive', { defaultValue: 'Active' })}</StatusTag>;
  }

  if (user.status === 'deactivated') {
    return (
      <StatusTag tone="gray">{t('userDeactivated', { defaultValue: 'Deactivated' })}</StatusTag>
    );
  }

  if (user.status === 'deleted') {
    const deleted = formatPortalDate(user.account_deleted_at, i18n.language) ?? '';
    const until = formatPortalDate(user.restorable_until, i18n.language);
    return (
      <StatusTag
        tone="red"
        title={
          until
            ? t('userDeletedHint', {
                deleted,
                until,
                defaultValue: 'Deleted by the user on {{deleted}}. It can be restored until {{until}}.',
              })
            : t('userDeletedHintExpired', {
                deleted,
                defaultValue: 'Deleted by the user on {{deleted}}.',
              })
        }
      >
        {t('userDeleted', { defaultValue: 'Account deleted' })}
      </StatusTag>
    );
  }

  return (
    <Flex gap={4} wrap align="center">
      {user.invite_expired ? (
        <StatusTag tone="red">
          {t('userInviteExpired', { defaultValue: 'Invite expired' })}
        </StatusTag>
      ) : (
        <StatusTag tone="orange">{t('userInvited', { defaultValue: 'Invited' })}</StatusTag>
      )}
      {user.invite_not_sent && (
        <StatusTag tone="gray">
          {t('userInviteNotSent', { defaultValue: 'Invite not sent yet' })}
        </StatusTag>
      )}
      {user.new_link_requested && (
        <StatusTag tone="red">
          {t('userAskedNewLink', { defaultValue: 'Asked for a new link' })}
        </StatusTag>
      )}
      {!user.email_verified && (
        <StatusTag tone="gray">
          {t('userEmailNotVerified', { defaultValue: 'Email not verified' })}
        </StatusTag>
      )}
    </Flex>
  );
};

/** An organization's portal access: Active when any user is Active, otherwise the next best state. */
export const OrganizationAccessTag = ({ access }: { access: OrganizationPortalAccess }) => {
  const { t } = useTranslation(NS);
  switch (access) {
    case 'active':
      return <StatusTag tone="green">{t('userActive', { defaultValue: 'Active' })}</StatusTag>;
    case 'invited':
      return <StatusTag tone="orange">{t('userInvited', { defaultValue: 'Invited' })}</StatusTag>;
    case 'deactivated':
      return (
        <StatusTag tone="gray">{t('userDeactivated', { defaultValue: 'Deactivated' })}</StatusTag>
      );
    default:
      return <StatusTag tone="gray">{t('orgNoUsers', { defaultValue: 'No users' })}</StatusTag>;
  }
};
